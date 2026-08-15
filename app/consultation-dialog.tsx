"use client";

import { FormEvent, useState } from "react";

type BouquetChoice = { id: string; name: string; price: string; scenes: string[] };
type Props = { bouquet: BouquetChoice; size: string; materialPlan: string; onClose: () => void };

export default function ConsultationDialog({ bouquet, size, materialPlan, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ reference: string; summary: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/consultations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bouquetId: bouquet.id, bouquetName: bouquet.name, priceRange: bouquet.price, size, materialPlan,
          scene: data.get("scene"), deliveryDate: data.get("deliveryDate"), budget: data.get("budget"),
          customerName: data.get("customerName"), contact: data.get("contact"), note: data.get("note"), website: data.get("website"),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "提交失败");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "提交失败"); }
    finally { setLoading(false); }
  }

  async function copySummary() {
    if (!result) return;
    await navigator.clipboard.writeText(result.summary);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  return <div className="consult-layer" role="dialog" aria-modal="true" aria-label="生成花礼咨询单">
    <button className="modal-backdrop" onClick={onClose} aria-label="关闭咨询单" />
    <div className="consult-card">
      <button className="close-button" onClick={onClose}>×</button>
      {!result ? <>
        <span className="kicker">FLORAL CONSULTATION</span><h2>生成花礼咨询单</h2>
        <p className="consult-intro">保存后会生成咨询编号，店主可以在后台看到。顾客无需注册账号。</p>
        <div className="choice-summary"><div><span>已选花礼</span><strong>{bouquet.name}</strong></div><div><span>体量</span><strong>{size}</strong></div><div><span>花材方案</span><strong>{materialPlan}</strong></div><div><span>参考价</span><strong>¥{bouquet.price}</strong></div></div>
        <form onSubmit={submit} className="consult-form">
          <label>使用场景<select name="scene" defaultValue={bouquet.scenes[0] || ""}><option value="">暂不确定</option>{bouquet.scenes.map(scene => <option key={scene}>{scene}</option>)}</select></label>
          <label>用花日期<input name="deliveryDate" type="date" /></label>
          <label>预算范围<input name="budget" placeholder="例如 500–800 元" /></label>
          <label>怎么称呼<input name="customerName" placeholder="选填" /></label>
          <label className="full">联系方式<input name="contact" placeholder="选填：微信号或手机号，便于门店联系" /></label>
          <label className="full">给花艺师的备注<textarea name="note" placeholder="例如偏爱自然感、不要太甜、送给男生等" /></label>
          <label className="honeypot" aria-hidden="true">网站<input name="website" tabIndex={-1} autoComplete="off" /></label>
          {error && <p className="form-error full">{error}</p>}
          <button className="submit-consult full" disabled={loading}>{loading ? "正在保存…" : "确认并生成咨询单"}<span>→</span></button>
        </form>
      </> : <div className="consult-success">
        <span className="success-mark">✓</span><small>已保存到店主后台</small><h2>{result.reference}</h2>
        <p>到店或联系花艺师时，提供这个咨询编号即可。</p><pre>{result.summary}</pre>
        <button onClick={copySummary}>{copied ? "已复制，可以粘贴到微信" : "复制咨询内容"}</button>
        <button className="ghost-action" onClick={onClose}>继续看花</button>
      </div>}
    </div>
  </div>;
}
