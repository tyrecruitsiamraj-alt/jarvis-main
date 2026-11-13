import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import BoardReleaseHeader from './BoardReleaseHeader';
import { RELEASE_LANE_TEXT, type ReleaseLaneKey, type ReleaseLedger } from '@/lib/boardRelease';
import type { LedgerState } from '@/lib/boardDataState';
afterEach(cleanup);
const ready: LedgerState = { status: 'ready', reason: null };
const ledger: ReleaseLedger = { all:329,released:157,unreleased:172,percent:48,steps:[],releasedWithApplicants:139,releasedSilent:18,applicantHeads:1992,releasable:74,startedAlready:98 };
const keys: ReleaseLaneKey[] = ['all','released','applied','silent','unreleased','sourcing','started'];
const counts = [329,157,139,18,172,74,98];
describe('approved compact strip preserves live bindings',()=>{
  it('renders all seven ordered filters, source counts, and applicant heads',()=>{
    render(<BoardReleaseHeader state={ready} ledger={ledger} lane={null} onLaneChange={()=>{}}/>);
    const tree=screen.getByTestId('board-release-tree');
    expect(within(tree).getAllByRole('button')).toHaveLength(7);
    expect([...tree.children].map(e=>e.getAttribute('data-testid'))).toEqual(keys.map(k=>`board-lane-${k}`));
    keys.forEach((key,i)=>expect(screen.getByTestId(`board-lane-${key}`)).toHaveTextContent(`${RELEASE_LANE_TEXT[key].label}${counts[i]}ใบ`));
    expect(screen.getByTestId('board-lane-applied')).toHaveTextContent('1,992 คน');
  });
  it.each(keys)('retains callback for %s',key=>{
    const onChange=vi.fn();render(<BoardReleaseHeader state={ready} ledger={ledger} lane={null} onLaneChange={onChange}/>);
    fireEvent.click(screen.getByTestId(`board-lane-${key}`));
    expect(onChange).toHaveBeenLastCalledWith(key==='all'?null:key);
  });
  it.each(keys)('active %s returns to all on repeated click',key=>{
    const onChange=vi.fn();render(<BoardReleaseHeader state={ready} ledger={ledger} lane={key} onLaneChange={onChange}/>);
    expect(screen.getByTestId(`board-lane-${key}`)).toHaveAttribute('aria-pressed','true');
    fireEvent.click(screen.getByTestId(`board-lane-${key}`));expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('reflects updated ledger instead of frozen prototype values',()=>{
    const props={state:ready,ledger,lane:null,onLaneChange:()=>{}};
    const view=render(<BoardReleaseHeader {...props}/>);
    view.rerender(<BoardReleaseHeader {...props} ledger={{...ledger,all:12,applicantHeads:4}}/>);
    expect(screen.getByTestId('board-lane-all')).toHaveTextContent('12ใบ');
    expect(screen.getByTestId('board-lane-all')).not.toHaveTextContent('329');
    expect(screen.getByTestId('board-lane-applied')).toHaveTextContent('4 คน');
  });
  it('keeps true zero values visible and clickable',()=>{
    const zero={...ledger,all:0,released:0,unreleased:0,releasedWithApplicants:0,releasedSilent:0,applicantHeads:0,releasable:0,startedAlready:0};
    const onChange=vi.fn();render(<BoardReleaseHeader state={ready} ledger={zero} lane={null} onLaneChange={onChange}/>);
    keys.forEach(k=>expect(screen.getByTestId(`board-lane-${k}`)).toHaveTextContent('0ใบ'));
    fireEvent.click(screen.getByTestId('board-lane-silent'));expect(onChange).toHaveBeenCalledWith('silent');
  });
  it('loading hides the previous ledger instead of showing old counts or fake zeros',()=>{
    render(<BoardReleaseHeader state={{status:'loading',reason:null}} ledger={ledger} lane={null} onLaneChange={()=>{}}/>);
    expect(screen.queryByTestId('board-release-tree')).toBeNull();
    expect(screen.queryByTestId('board-lane-all')).toBeNull();
  });
  it('read failure shows unknown and retains retry',()=>{
    const onRetry=vi.fn();render(<BoardReleaseHeader state={{status:'broken',reason:'failed'}} ledger={ledger} lane={null} onLaneChange={()=>{}} onRetry={onRetry}/>);
    keys.forEach(k=>{const b=screen.getByTestId(`board-lane-${k}`);expect(b).toHaveTextContent('—');expect(b).toBeDisabled()});
    fireEvent.click(screen.getByRole('button',{name:'กดลองใหม่'}));expect(onRetry).toHaveBeenCalledTimes(1);
  });
  it('permission failure does not provide a useless retry',()=>{
    render(<BoardReleaseHeader state={{status:'broken',reason:'forbidden'}} ledger={ledger} lane={null} onLaneChange={()=>{}} onRetry={()=>{}}/>);
    expect(screen.queryByRole('button',{name:'กดลองใหม่'})).toBeNull();
    keys.forEach(k=>expect(screen.getByTestId(`board-lane-${k}`)).toBeDisabled());
  });
  it('preserves stale-data label and source hint',()=>{
    render(<BoardReleaseHeader state={ready} ledger={ledger} lane={null} onLaneChange={()=>{}} ageLabel="ข้อมูลสำเนา · 10 นาที"/>);
    expect(screen.getByText('ข้อมูลสำเนา · 10 นาที')).toBeTruthy();
    expect(screen.getByTestId('board-lane-sourcing')).toHaveAttribute('title',RELEASE_LANE_TEXT.sourcing.hint);
  });
});
