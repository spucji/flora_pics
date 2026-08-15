"use client";

import { FormEvent, useEffect, useState } from "react";

type Ledger = { id:number; amount:number; type:string; reason:string; createdAt:string };
type Member = { id:number; code:string; name:string; contact:string; note:string; balance:number; createdAt:string; ledger:Ledger[] };

export default function MemberManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true); setError("");
    try { const response = await fetch("/api/owner/members"); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); setMembers(payload.members); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "读取失败"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/owner/members").then(async response => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error); return payload; })
      .then(payload => { if (active) setMembers(payload.members); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setError("");
    const form = event.currentTarget; const data = new FormData(form);
    try {
      const response = await fetch("/api/owner/members", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"create", name:data.get("name"), contact:data.get("contact"), note:data.get("note") }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "创建会员失败");
      form.reset(); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "创建会员失败"); }
    finally { setCreating(false); }
  }

  async function redeem(member: Member) {
    const raw = window.prompt(`当前可用 ${member.balance} 元。请输入本次抵扣金额：`); if (!raw) return;
    const amount = Number(raw); const reason = window.prompt("填写抵扣对应的订单号或说明：", "购花抵扣") || "购花抵扣";
    const response = await fetch("/api/owner/members", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action:"redeem", memberId:member.id, amount, reason }) });
    const payload = await response.json(); if (!response.ok) { setError(payload.error); return; } await load();
  }

  return <div className="member-manager">
    <form className="member-create" onSubmit={createMember}><div><h2>新增会员</h2><p>会员无需注册账号，由店主登记并提供推荐码。</p></div><label>会员称呼<input name="name" required placeholder="例如 王女士" /></label><label>联系方式<input name="contact" placeholder="微信号或手机号" /></label><label>备注<input name="note" placeholder="偏好、纪念日等（选填）" /></label><button disabled={creating}>{creating?"正在创建…":"创建会员"}</button></form>
    <div className="member-policy"><b>推荐金规则</b><span>推荐新顾客并由店主确认成交后 +10 元；仅限购花抵扣，不可充值、提现或转账；退款时自动撤回。</span></div>
    {error&&<div className="owner-empty error">{error}</div>}
    {loading?<div className="owner-empty">正在读取会员资料…</div>:members.length===0?<div className="owner-empty">还没有会员，先登记第一位吧。</div>:<div className="member-list">{members.map(member=><article key={member.id}><header><div><small>{member.code}</small><h2>{member.name}</h2><p>{member.contact||"未留联系方式"}</p></div><div className="member-balance"><span>可用推荐金</span><strong>¥{member.balance}</strong><button onClick={()=>redeem(member)} disabled={member.balance<=0}>登记抵扣</button></div></header>{member.note&&<p className="member-note">{member.note}</p>}<div className="ledger"><h3>最近流水</h3>{member.ledger.length===0?<p>暂无推荐金流水</p>:member.ledger.map(row=><div key={row.id}><span><b>{row.reason}</b><small>{row.createdAt}</small></span><strong className={row.amount>0?"plus":"minus"}>{row.amount>0?"+":""}{row.amount} 元</strong></div>)}</div></article>)}</div>}
  </div>;
}
