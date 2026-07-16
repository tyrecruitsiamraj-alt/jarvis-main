import { describe, expect, it } from 'vitest';
import {
  classifyJobFamily,
  candidateMatchesFamily,
  fallbackKeywords,
} from '../../src/lib/jobFamilyLexicon';

describe('classifyJobFamily', () => {
  it('classifies driver jobs into family C', () => {
    expect(classifyJobFamily('ขับรถ ชนิดที่ 2')).toBe('C');
    expect(classifyJobFamily('พนักงานขับรถ ส่วนกลาง')).toBe('C');
    expect(classifyJobFamily('Valet Parking')).toBe('C');
  });

  it('classifies technical/IT jobs into family B', () => {
    expect(classifyJobFamily('ช่างไฟฟ้า')).toBe('B');
    expect(classifyJobFamily('IT Support / Helpdesk')).toBe('B');
    expect(classifyJobFamily('Programmer')).toBe('B');
  });

  it('classifies admin/back-office into family D', () => {
    expect(classifyJobFamily('ธุรการ')).toBe('D');
    expect(classifyJobFamily('แคชเชียร์')).toBe('D');
    expect(classifyJobFamily('แม่บ้าน ทำความสะอาด')).toBe('D');
  });

  it('classifies security into E and gardening into F', () => {
    expect(classifyJobFamily('รปภ.')).toBe('E');
    expect(classifyJobFamily('คนสวน ดูแลภูมิทัศน์')).toBe('F');
  });

  it('classifies presentation-forward into A', () => {
    expect(classifyJobFamily('พนักงานต้อนรับ ประชาสัมพันธ์')).toBe('A');
  });

  it('returns null when the title carries no family signal', () => {
    expect(classifyJobFamily('พนักงาน ทั่วไป')).toBeNull();
    expect(classifyJobFamily('')).toBeNull();
  });

  it('prefers the family with the stronger signal', () => {
    // "ขับรถ" (C) should win over an incidental generic token
    expect(classifyJobFamily('พนักงานขับรถผู้บริหาร')).toBe('C');
  });
});

describe('candidateMatchesFamily', () => {
  it('matches a driver candidate to family C, not to unrelated families', () => {
    expect(candidateMatchesFamily('ขับรถ / ส่วนกลาง', 'C')).toBe(true);
    expect(candidateMatchesFamily('ขับรถ / ส่วนกลาง', 'D')).toBe(false);
    expect(candidateMatchesFamily('ขับรถ / ส่วนกลาง', 'B')).toBe(false);
  });

  it('matches an admin candidate to family D', () => {
    expect(candidateMatchesFamily('ธุรการ / คีย์ข้อมูล', 'D')).toBe(true);
  });

  it('returns false for empty candidate text', () => {
    expect(candidateMatchesFamily('', 'C')).toBe(false);
  });
});

describe('fallbackKeywords', () => {
  it('drops stopwords and short tokens', () => {
    const kws = fallbackKeywords('พนักงาน ควบคุมคุณภาพ QC');
    expect(kws).not.toContain('พนักงาน');
    expect(kws).toContain('ควบคุมคุณภาพ');
  });
});
