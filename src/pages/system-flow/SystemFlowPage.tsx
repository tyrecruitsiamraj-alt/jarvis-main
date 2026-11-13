/**
 * ═══ Flow ระบบ — ผังกล่องต่อเส้นแบบ n8n (เจ้าของ 13 พ.ย. 2569 · เมนูใหม่ เห็นเฉพาะ admin) ═══
 * กล่อง = หน้า/แท็บ/ป๊อป/ระบบภายนอก · แถวในกล่อง = ปุ่มบนจอ · เส้นออกจากปุ่มไปที่ที่ปุ่มพาไป
 * เส้นแดง = ปุ่มนั้นไปถึงคนจริง (Lumos โทร · So Scraping · ส่งข้อความ) · เส้นทอง = อ่านระบบภายนอก/เรียก AI · เส้นเทา = พาไปหน้า/ป๊อป
 * ข้อมูล `src/lib/systemFlow/flowScreens.json` (ไล่จากโค้ดทุกปุ่ม พร้อมไฟล์:บรรทัด) · ตัวโยงเส้น `graph.ts` · หาปลายทางไม่เจอ = โชว์ในรายการ ไม่เดา
 */
import React, { useMemo, useState } from 'react';
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { buildFlowGraph, FLOW_SYSTEMS, menuOf, type FlowControl, type FlowEffect, type FlowScreen } from '@/lib/systemFlow/graph';
import rawScreens from '@/lib/systemFlow/flowScreens.json';

const SCREENS = (rawScreens as { screens: FlowScreen[] }).screens;
const PEOPLE: FlowEffect[] = ['ส่ง Lumos โทร', 'สั่ง So Scraping', 'ส่งข้อความออก'];
const KIND_LABEL: Record<FlowScreen['kind'], string> = { page: 'หน้า', tab: 'แท็บ', popup: 'ป๊อป', system: 'ระบบภายนอก' };
/** ขนาดกล่องคิดจาก rem ของเว็บ (html = 18px) — ใส่ px ตายตัวแล้วกล่องจริงสูงกว่าที่จัดวาง ซ้อนกัน */
const REM = typeof document === 'undefined' ? 16 : parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const NODE_W = 20 * REM; // w-80
const ROW_H = 1.75 * REM; // h-7
const HEAD_H = 2.4 * REM + 1; // หัวกล่อง py-2 + ป้ายชนิด + เส้นคั่น
const ALL = '__all__';
/** เปิดเมนูมาเห็นกล่องของเมนูนั้นที่ขนาดอ่านออก (ย่อให้พอดีทั้งผัง = ตัวหนังสือเล็กจนอ่านไม่ได้) · ที่เหลือลาก/ซูมดู */
const OPEN_ZOOM = 0.75;
/** compact = จอของเมนูอื่นที่ปุ่มในเมนูนี้พาไป — โชว์แค่หัวกล่อง (ปุ่มของมันดูในผังเมนูของมันเอง) */
const nodeHeight = (s: FlowScreen, compact = false) => HEAD_H + (compact ? 1 : Math.max(1, s.controls.length)) * ROW_H;

type NodeData = { screen: FlowScreen; selected: number | null; dim: boolean; onPick: (i: number) => void; compact: boolean; menuTitle: string; onOpenMenu: () => void };

function effectTone(effects: readonly string[]): keyof typeof TONE | null {
  if (effects.some((e) => PEOPLE.includes(e as FlowEffect))) return 'danger';
  if (effects.length) return 'warn';
  return null;
}

function ScreenNode({ data }: NodeProps<Node<NodeData>>) {
  const { screen, selected, dim, onPick, compact, menuTitle, onOpenMenu } = data;
  return (
    <Card variant="solid" className={cn('w-80 overflow-hidden p-0 transition-opacity', dim && 'opacity-30')}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3" />
      <div className={cn('flex items-center justify-between gap-2 border-b border-border px-3 py-2', screen.kind === 'system' && TONE.danger.soft)}>
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{screen.title}</span>
        <Badge variant="outline" className="shrink-0 text-xs font-normal">
          {KIND_LABEL[screen.kind]}
        </Badge>
      </div>
      {compact && screen.kind !== 'system' ? (
        <button type="button" onClick={onOpenMenu} className={cn('nodrag flex h-7 w-full items-center px-3 text-left text-xs hover:bg-muted', DASH.sub)}>
          <span className="min-w-0 truncate">ดูผังเมนู {menuTitle}</span>
        </button>
      ) : screen.controls.length === 0 ? (
        <p className={cn('px-3 py-1.5 text-xs', DASH.sub)}>{screen.kind === 'system' ? 'ปลายทางนอกระบบ' : 'ไม่มีปุ่ม'}</p>
      ) : (
        <ul>
          {screen.controls.map((c, i) => {
            const tone = effectTone(c.effects);
            return (
              <li key={i} className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(i);
                  }}
                  className={cn('nodrag flex h-7 w-full items-center gap-1.5 px-3 text-left text-xs hover:bg-muted', selected === i && 'bg-muted font-medium')}
                >
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {tone ? <span className={cn('shrink-0', TONE[tone].value)}>{tone === 'danger' ? 'ถึงคนจริง' : c.effects[0]}</span> : null}
                </button>
                <Handle type="source" id={`c${i}`} position={Position.Right} className="!h-2 !w-2" style={{ top: ROW_H / 2 }} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
const nodeTypes = { screen: ScreenNode };

/**
 * ผังของเมนูเดียว: คอลัมน์ = กดกี่ครั้งจากหน้าเมนูถึงจอนั้น · จอของเมนูอื่น/ระบบภายนอกอยู่คอลัมน์ขวาสุด
 * ในคอลัมน์เรียงตามตำแหน่งปุ่มที่พามา (เส้นไขว้กันน้อย) · หน้าเมนูอยู่มุมซ้ายบนเสมอ เปิดมาอ่านได้เลย
 */
function menuLayout(root: string, screens: FlowScreen[], inMenu: Set<string>, edges: Array<{ from: string; control: number; to: string }>): Map<string, { x: number; y: number }> {
  const col = new Map<string, number>([[root, 0]]);
  for (const q = [root]; q.length; ) {
    const id = q.shift()!;
    for (const e of edges) {
      if (e.from !== id || !inMenu.has(e.to) || col.has(e.to)) continue;
      col.set(e.to, col.get(id)! + 1);
      q.push(e.to);
    }
  }
  // จอในเมนูที่ไม่มีปุ่มไหนพามา (เปิดจากเงื่อนไข/ลิงก์ตรง) = ถัดจากจอแม่
  for (let moved = true; moved; ) {
    moved = false;
    for (const s of screens) {
      if (!inMenu.has(s.id) || col.has(s.id) || !s.parent || !col.has(s.parent)) continue;
      col.set(s.id, col.get(s.parent)! + 1);
      moved = true;
    }
  }
  const last = Math.max(...col.values()) + 1;
  for (const s of screens) if (!col.has(s.id)) col.set(s.id, inMenu.has(s.id) ? 1 : last);

  const pos = new Map<string, { x: number; y: number }>();
  for (let c = 0; c <= last; c++) {
    const at = (id: string) => {
      const ys = edges.filter((e) => e.to === id && pos.has(e.from)).map((e) => pos.get(e.from)!.y + HEAD_H + e.control * ROW_H);
      return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : Number.POSITIVE_INFINITY;
    };
    let y = 0;
    for (const { s } of screens.filter((x) => col.get(x.id) === c).map((x) => ({ s: x, k: at(x.id) })).sort((a, b) => a.k - b.k)) {
      pos.set(s.id, { x: c * (NODE_W + 160), y });
      y += nodeHeight(s, !inMenu.has(s.id)) + 24;
    }
  }
  return pos;
}

function layout(screens: FlowScreen[], edges: Array<{ from: string; to: string }>): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 24, ranksep: 140 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const s of screens) g.setNode(s.id, { width: NODE_W, height: nodeHeight(s) });
  for (const e of edges) if (g.hasNode(e.from) && g.hasNode(e.to)) g.setEdge(e.from, e.to);
  dagre.layout(g);
  return new Map(screens.map((s) => {
    const n = g.node(s.id);
    return [s.id, { x: n.x - n.width / 2, y: n.y - n.height / 2 }];
  }));
}

export default function SystemFlowPage() {
  const all = useMemo(() => {
    const sys: FlowScreen[] = FLOW_SYSTEMS.map((x) => ({ id: x.id, kind: 'system', title: x.title, route: null, parent: null, src: '', controls: [] }));
    const screens = [...SCREENS, ...sys];
    const graph = buildFlowGraph(screens);
    return { screens: screens.filter((s) => s.kind !== 'system' || graph.systemsUsed.has(s.id)), graph };
  }, []);
  const menus = useMemo(() => all.screens.filter((s) => s.kind === 'page' && !s.parent).map((s) => ({ value: s.id, label: s.title })), [all]);
  // เปิดมาเห็นทีละเมนู (ทุกเมนูพร้อมกัน = 250 กล่อง อ่านไม่ออก) · "ทุกเมนู" ยังเลือกได้
  const [menu, setMenu] = useState(() => menus[0]?.value ?? ALL);
  const [pick, setPick] = useState<{ screen: string; control: number } | null>(null);

  // เลือกเมนู = จอในเมนูนั้น + ปลายทางที่ปุ่มของมันพาไป (เห็นว่าโยงไปเมนูไหน)
  const inMenu = useMemo(
    () => new Set(all.screens.filter((s) => menu === ALL || (s.kind !== 'system' && menuOf(all.screens, s.id) === menu)).map((s) => s.id)),
    [all, menu],
  );
  // เส้นของเมนูนี้ = เส้นที่ออกจากปุ่มในเมนูนี้เท่านั้น (ปุ่มของเมนูอื่นดูในผังของมันเอง)
  const edges = useMemo(() => all.graph.edges.filter((e) => inMenu.has(e.from)), [all, inMenu]);
  const shown = useMemo(() => {
    const targets = new Set(edges.map((e) => e.to));
    return all.screens.filter((s) => inMenu.has(s.id) || targets.has(s.id));
  }, [all, inMenu, edges]);
  const pos = useMemo(() => (menu === ALL ? layout(shown, edges) : menuLayout(menu, shown, inMenu, edges)), [menu, shown, inMenu, edges]);
  const titleOf = (id: string) => all.screens.find((s) => s.id === id)?.title ?? id;
  const openMenu = (id: string) => {
    setMenu(id);
    setPick(null);
  };

  const lit = pick ? new Set(edges.filter((e) => e.from === pick.screen && e.control === pick.control).map((e) => e.to).concat(pick.screen)) : null;
  const nodes: Node<NodeData>[] = shown.map((s) => ({
    id: s.id,
    type: 'screen',
    position: pos.get(s.id) ?? { x: 0, y: 0 },
    data: {
      screen: s,
      selected: pick?.screen === s.id ? pick.control : null,
      dim: Boolean(lit && !lit.has(s.id)),
      onPick: (i) => setPick({ screen: s.id, control: i }),
      compact: !inMenu.has(s.id),
      menuTitle: titleOf(menuOf(all.screens, s.id)),
      onOpenMenu: () => openMenu(menuOf(all.screens, s.id)),
    },
  }));
  const flowEdges: Edge[] = edges.map((e) => {
    const on = !pick || (e.from === pick.screen && e.control === pick.control);
    const people = e.effect && PEOPLE.includes(e.effect);
    const color = people ? 'hsl(var(--destructive))' : e.kind === 'effect' ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground))';
    return {
      id: e.id,
      source: e.from,
      sourceHandle: `c${e.control}`,
      target: e.to,
      animated: Boolean(people && on),
      style: { stroke: color, strokeWidth: on && pick ? 2.5 : 1.25, opacity: on ? 1 : 0.12 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });

  const picked: { screen: FlowScreen; c: FlowControl } | null = pick
    ? (() => {
        const s = all.screens.find((x) => x.id === pick.screen);
        return s ? { screen: s, c: s.controls[pick.control] } : null;
      })()
    : null;
  const pickedTargets = pick ? edges.filter((e) => e.from === pick.screen && e.control === pick.control).map((e) => titleOf(e.to)) : [];

  return (
    <div className="space-y-4" data-testid="system-flow">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-foreground">Flow ระบบ</h1>
          <p className={cn('text-sm tabular-nums', DASH.sub)}>
            {all.screens.filter((s) => s.kind !== 'system').length} จอ · {all.graph.edges.length} เส้น
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FieldSelect value={menu} onChange={openMenu} options={[...menus, { value: ALL, label: 'ทุกเมนู' }]} ariaLabel="เลือกเมนู" testId="flow-menu" className="w-56" />
          {pick ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setPick(null)}>
              ล้างที่เลือก
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={DASH.sub}>เส้นเทา = พาไปหน้า/ป๊อป</span>
        <span className={TONE.danger.value}>เส้นแดง = ไปถึงคนจริง (AI โทร · Autopost/Scrap · ส่งข้อความ)</span>
        <span className={TONE.warn.value}>เส้นทอง = อ่านระบบภายนอก / เรียก AI</span>
      </div>

      <Card variant="solid" className="h-[70vh] overflow-hidden p-0">
        <ReactFlow
          key={menu}
          nodes={nodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView={menu === ALL}
          defaultViewport={{ x: 24, y: 24, zoom: OPEN_ZOOM }}
          minZoom={0.05}
          onPaneClick={() => setPick(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </Card>

      {picked?.c ? (
        <Card variant="solid" className="space-y-1 p-4 text-sm" data-testid="flow-picked">
          <p className="font-medium text-foreground">
            {picked.screen.title} › {picked.c.label}
          </p>
          <p className={DASH.sub}>ไปที่: {pickedTargets.length ? pickedTargets.join(' · ') : picked.c.target ?? '—'}</p>
          {picked.c.effects.length ? <p className={effectTone(picked.c.effects) === 'danger' ? TONE.danger.value : TONE.warn.value}>ผล: {picked.c.effects.join(' · ')}</p> : null}
          {picked.c.when ? <p className={DASH.sub}>เงื่อนไข: {picked.c.when}</p> : null}
          <p className={cn('text-xs', DASH.sub)}>{picked.c.src}</p>
        </Card>
      ) : null}

      <Card variant="solid" className="space-y-2 p-4" data-testid="flow-unresolved">
        <p className="text-sm font-medium text-foreground">ยังโยงเส้นไม่ได้ {all.graph.unresolved.length} ปุ่ม</p>
        {all.graph.unresolved.length === 0 ? (
          <p className={cn('text-sm', DASH.sub)}>ทุกปุ่มมีปลายทางแล้ว</p>
        ) : (
          <ul className="max-h-60 space-y-0.5 overflow-y-auto text-xs">
            {all.graph.unresolved.map((u) => (
              <li key={`${u.screen}#${u.control}`} className={DASH.sub}>
                {all.screens.find((s) => s.id === u.screen)?.title ?? u.screen} › {u.label} → {u.target ?? 'ไม่ระบุ'}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
