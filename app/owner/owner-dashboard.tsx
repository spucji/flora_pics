"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MemberManager from "./member-manager";

type Status = "pending" | "contacted" | "purchased" | "cancelled";
type Consultation = {
  id:number; reference:string; bouquetId:string; bouquetName:string; size:string; materialPlan:string;
  priceRange:string; scene:string; deliveryDate:string; budget:string; customerName:string; contact:string;
  note:string; referralCode:string; purchaseAmount:number; rewardGranted:boolean; status:Status; createdAt:string;
};
const statusText: Record<Status,string> = { pending:"待联系", contacted:"已联系", purchased:"已成交", cancelled:"已取消" };

export default function OwnerDashboard({ account, signOutPath }: { account:string; signOutPath:string }) {
  const [view,setView]=useState<"consultations"|"members">("consultations");
  const [items,setItems]=useState<Consultation[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [filter,setFilter]=useState<"all"|Status>("all");
  useEffect(()=>{fetch("/api/owner/consultations").then(async response=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error);return payload;}).then(payload=>setItems(payload.consultations)).catch(cause=>setError(cause.message)).finally(()=>setLoading(false));},[]);

  async function updateStatus(item:Consultation,status:Status){
    let purchaseAmount=item.purchaseAmount;
    if(status==="purchased"&&!purchaseAmount){const raw=window.prompt("请输入本次实际成交金额（元）：",item.priceRange.split("–")[0]);if(raw===null)return;purchaseAmount=Math.max(0,Math.round(Number(raw)||0));}
    const response=await fetch("/api/owner/consultations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status,purchaseAmount})});
    const payload=await response.json();if(!response.ok){setError(payload.error);return;}
    setItems(current=>current.map(row=>row.id===item.id?{...row,status,purchaseAmount,rewardGranted:Boolean(payload.rewardGranted)}:row));
  }
  const visible=filter==="all"?items:items.filter(item=>item.status===filter);
  return <main className="owner-dashboard">
    <aside><Link className="owner-brand" href="/"><b>F</b><span>FLORA<small>OWNER STUDIO</small></span></Link><nav><button onClick={()=>setView("consultations")} className={view==="consultations"?"active":""}>咨询单 <i>{items.length}</i></button><button onClick={()=>setView("members")} className={view==="members"?"active":""}>会员与推荐 <span>→</span></button><a href="/owner/editor">花礼与场景管理 <span>→</span></a></nav><div className="owner-account"><small>已登录店主</small><span>{account}</span><a href={signOutPath}>退出登录</a></div></aside>
    <section className="owner-content"><header><div><small>{view==="consultations"?"CONSULTATION DESK":"MEMBER LEDGER"}</small><h1>{view==="consultations"?"顾客咨询单":"会员与推荐金"}</h1></div><Link href="/">打开顾客页 ↗</Link></header>
      {view==="members"?<MemberManager/>:<><div className="owner-filters">{(["all","pending","contacted","purchased","cancelled"] as const).map(value=><button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{value==="all"?"全部":statusText[value]} <span>{value==="all"?items.length:items.filter(item=>item.status===value).length}</span></button>)}</div>
      {loading?<div className="owner-empty">正在读取咨询单…</div>:error?<div className="owner-empty error">{error}</div>:visible.length===0?<div className="owner-empty">还没有这个状态的咨询单。</div>:<div className="consultation-list">{visible.map(item=><article key={item.id}><div className="ticket-head"><div><small>{item.reference}</small><h2>{item.bouquetName}</h2></div><select value={item.status} onChange={event=>updateStatus(item,event.target.value as Status)}><option value="pending">待联系</option><option value="contacted">已联系</option><option value="purchased">确认成交</option><option value="cancelled">取消 / 退款</option></select></div><div className="ticket-grid"><p><span>款式</span>{item.bouquetId} · {item.size}</p><p><span>花材方案</span>{item.materialPlan}</p><p><span>参考价 / 成交价</span>¥{item.priceRange}{item.purchaseAmount?` / ¥${item.purchaseAmount}`:""}</p><p><span>场景 / 日期</span>{item.scene||"未填写"}{item.deliveryDate?` · ${item.deliveryDate}`:""}</p><p><span>预算</span>{item.budget||"未填写"}</p><p><span>顾客</span>{item.customerName||"未留称呼"}{item.contact?` · ${item.contact}`:""}</p><p><span>会员推荐码</span>{item.referralCode||"无"}{item.rewardGranted?" · 已入账10元":""}</p></div>{item.note&&<blockquote>{item.note}</blockquote>}<footer>提交时间：{item.createdAt}</footer></article>)}</div>}</>}
    </section>
  </main>;
}
