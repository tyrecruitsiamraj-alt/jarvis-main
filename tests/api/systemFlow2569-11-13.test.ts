/**
 * Flow ระบบ (เจ้าของ 13 พ.ย. 2569 "แบบ N8N … ปุ่มไหนกดแล้วไปโยงกะ menu อื่นก็ลากให้ดู") — ตัวโยงเส้น + ข้อมูลต้องครบ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFlowGraph, menuOf, resolveTarget, resolveTargets, routeMatches, routesIn, type FlowScreen } from '@/lib/systemFlow/graph';
import data from '@/lib/systemFlow/flowScreens.json';

const S = (o: Partial<FlowScreen> & { id: string }): FlowScreen => ({ kind: 'page', title: o.id, route: null, parent: null, src: 'x:1', controls: [], ...o });
const C = (o: Partial<FlowScreen['controls'][number]>) => ({ label: 'ปุ่ม', action: 'navigate' as const, target: null, api: null, effects: [], when: null, src: 'x:1', ...o });

describe('ตัวโยงเส้น', () => {
  it('route: :id แทนค่าจริง · query ของจอต้องอยู่ในปุ่ม · path เจาะจงชนะ', () => {
    expect(routeMatches('/jobs/siamraj/:id', '/jobs/siamraj/siamraj-pre%3ALBM6909002')).toBe(true);
    expect(routeMatches('/jobs/board?view=dashboard', '/jobs/board?view=dashboard&from=1')).toBe(true);
    expect(routeMatches('/jobs/board?view=dashboard', '/jobs/board')).toBe(false);
    const screens = [S({ id: 'detail', route: '/jobs/siamraj/:id' }), S({ id: 'actions', route: '/jobs/siamraj/:id/actions' }), S({ id: 'home', route: '/' })];
    expect(resolveTarget(screens, screens[2], C({ target: '/jobs/siamraj/123/actions' }))).toBe('actions');
    expect(resolveTarget(screens, screens[2], C({ target: '/jobs/siamraj/123' }))).toBe('detail');
  });
  it('ป๊อปหาจากชื่อในจอแม่ก่อน · ผลข้างเคียงลากเส้นไปกล่องระบบภายนอก · หาไม่เจอ = รายการยังโยงไม่ได้ (ไม่เดา)', () => {
    const screens = [
      S({ id: 'board', route: '/jobs/board', controls: [C({ label: 'Autopost', action: 'popup', target: 'Autopost / Scrap / โพสต์เอง', effects: ['สั่ง So Scraping'] }), C({ label: 'ลึกลับ', target: '/nope' })] }),
      S({ id: 'order', kind: 'popup', title: 'Autopost / Scrap / โพสต์เอง', parent: 'board' }),
    ];
    const g = buildFlowGraph(screens);
    expect(g.edges.map((e) => e.to).sort()).toEqual(['order', 'sys-so']);
    expect(g.unresolved).toEqual([{ screen: 'board', control: 1, label: 'ลึกลับ', target: '/nope' }]);
    expect(menuOf(screens, 'order')).toBe('board');
  });
  it('เส้นทางสำรองของจอ · ?view= ต่อท้าย route ของเมนูที่ปุ่มอยู่ · ปุ่มเดียวหลายปลายทาง = หลายเส้น', () => {
    expect(routesIn('?view=match', '/jobs/board')).toEqual(['/jobs/board?view=match']);
    expect(routesIn('?view=match')).toEqual([]);
    const screens = [
      S({ id: 'board', route: '/jobs/board', controls: [C({ action: 'tab', target: '?view=match' }), C({ target: '/sale · /follow (ตามงานถัดไป)' })] }),
      S({ id: 'match', kind: 'tab', route: '/jobs/board?view=match', parent: 'board' }),
      S({ id: 'hub', route: '/opl', aliases: ['/sale', '/staff'] }),
      S({ id: 'follow', route: '/follow' }),
    ];
    expect(resolveTargets(screens, screens[0], screens[0].controls[0])).toEqual(['match']);
    expect(resolveTargets(screens, screens[0], screens[0].controls[1])).toEqual(['hub', 'follow']);
    expect(buildFlowGraph(screens).edges.map((e) => e.id)).toEqual(['board#0>match', 'board#1>hub', 'board#1>follow']);
  });
  it('ปลายทางเขียนเป็น id จอ: id มีขีดใช้ปนข้อความได้ · id คำเดียวต้องเป็นทั้งปลายทาง (กันคำทั่วไปอย่าง settings ไปโยงมั่ว)', () => {
    const screens = [
      S({ id: 'home', route: '/', controls: [C({ action: 'popup', target: 'popup-pick popup-confirm' }), C({ action: 'popup', target: 'settings' }), C({ action: 'popup', target: 'เปิด settings ของกล่อง' })] }),
      S({ id: 'popup-pick', kind: 'popup', title: 'เลือกงาน' }),
      S({ id: 'popup-confirm', kind: 'popup', title: 'ยืนยัน' }),
      S({ id: 'settings', route: '/settings', title: 'ตั้งค่า' }),
    ];
    const g = buildFlowGraph(screens);
    expect(g.edges.map((e) => e.to)).toEqual(['popup-pick', 'popup-confirm', 'settings']);
    expect(g.unresolved.map((u) => u.control)).toEqual([2]);
  });
  it('ปุ่มที่เปลี่ยนของในจอเดิม (inline) ไม่มีเส้นและไม่นับว่ายังโยงไม่ได้ · ดาวน์โหลด/คัดลอก = เครื่องของคนกด', () => {
    const screens = [S({ id: 'home', route: '/', controls: [C({ label: 'ปิด', action: 'inline', target: 'ปิดป๊อป' }), C({ label: 'Excel', action: 'external', target: 'ดาวน์โหลดไฟล์ .xlsx' })] })];
    const g = buildFlowGraph(screens);
    expect(g.edges.map((e) => e.to)).toEqual(['sys-device']);
    expect(g.unresolved).toEqual([]);
  });
});

describe('ข้อมูลผัง (ไล่จากโค้ดจริง)', () => {
  const screens = (data as { screens: FlowScreen[] }).screens;
  it('ทุกจอ/ปุ่มอ้างไฟล์:บรรทัดได้ · id ไม่ซ้ำ', () => {
    const ids = screens.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of screens) {
      expect(s.src, s.id).toMatch(/:\d+/);
      for (const c of s.controls) expect(c.src, `${s.id} › ${c.label}`).toMatch(/:\d+/);
    }
  });
  it('ทุก route จริงใน App.tsx มีกล่องในผัง (หน้าใหม่ลืมใส่ = เทสต์ตก)', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const routes = [...app.matchAll(/<Route path="([^"*]+)" element=\{<(?!Navigate|Redirect)/g)].map((m) => m[1]);
    const covered = (r: string) => screens.some((s) => [s.route, ...(s.aliases ?? [])].some((x) => x && x.split('?')[0] === r));
    const missing = routes.filter((r) => !covered(r));
    expect(missing).toEqual([]);
  });
  it('ปุ่มที่ยังโยงไม่ได้เหลือเฉพาะที่ปลายทางไม่ตายตัว (เพิ่มขึ้น = มีปุ่มใหม่ที่ยังไม่ได้ไล่ปลายทาง)', () => {
    expect(buildFlowGraph(screens).unresolved.length).toBeLessThanOrEqual(6);
  });
});
