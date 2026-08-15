/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions, no-irregular-whitespace */
"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import ConsultationDialog from "./consultation-dialog";
import { Bouquet, initialBouquets, initialScenes, isCatalogState } from "../lib/catalog-data";
type AiDraft = { nameCandidates: string[]; colorTag: string; subtitle: string; description: string; recommendedScenes: string[]; flowerHints: string[]; confidenceNote: string };

const sizeInfo: Record<string, string> = {
  XS: "约 20–25cm，轻巧不张扬，适合日常见面与随手小惊喜。",
  S: "约 28–33cm，自然耐看，适合生日、纪念日与一般拜访。",
  M: "约 35–40cm，层次丰富，适合正式见面、告白与仪式场合。",
  L: "约 45–55cm，体量饱满、镜头感强，适合重要庆祝与布置。",
};

const materialPlans = [
  { title:"原版花材", text:"保留主花、配花与色彩比例，尽量还原图示效果。" },
  { title:"时令同色替换", text:"根据当日花市，以同色、同质感花材调整，保留整体风格。" },
  { title:"进口花材升级", text:"在体量基本不变的情况下，替换部分主花，增加稀缺度与精致度。" },
];

export default function CatalogClient({ ownerMode = false }: { ownerMode?: boolean }) {
  const [activeScene, setActiveScene] = useState("全部");
  const [scenes, setScenes] = useState(initialScenes);
  const [bouquets, setBouquets] = useState(initialBouquets);
  const [selected, setSelected] = useState<Bouquet | null>(null);
  const [selectedSize, setSelectedSize] = useState("M");
  const [material, setMaterial] = useState(0);
  const [adminOpen, setAdminOpen] = useState(ownerMode);
  const [consultOpen, setConsultOpen] = useState(false);
  const [editingId, setEditingId] = useState(initialBouquets[0].id);
  const [saved, setSaved] = useState(false);
  const [adminView, setAdminView] = useState<"bouquets" | "scenes">("bouquets");
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/catalog", { cache:"no-store" }).then(async response => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "花礼目录读取失败");
      return payload as unknown;
    }).then(payload => {
      if (!active || !isCatalogState(payload)) return;
      setScenes(payload.scenes);
      setBouquets(payload.bouquets);
      setEditingId(payload.bouquets[0]?.id || "");
    }).catch(error => {
      if (active) setCatalogError(error instanceof Error ? error.message : "花礼目录读取失败");
    }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => activeScene === "全部" ? bouquets : bouquets.filter(b => b.scenes.includes(activeScene)), [activeScene, bouquets]);
  const editing = bouquets.find(b => b.id === editingId) ?? bouquets[0];
  const visibleScenes = scenes.filter(scene => !scene.hidden);

  function updateEditing<K extends keyof Bouquet>(key: K, value: Bouquet[K]) {
    setBouquets(items => items.map(item => item.id === editing.id ? { ...item, [key]: value } : item));
    setSaved(false);
  }

  async function uploadPreview(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { setAiError("图片请控制在 8MB 以内。"); return; }
    setAiError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/images", { method:"POST", body:form });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error || "图片上传失败");
      updateEditing("image", data.url);
      setAiDraft(null);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "图片上传失败");
    } finally { event.target.value = ""; }
  }

  async function analyzeImage() {
    setAiLoading(true); setAiError(""); setAiDraft(null);
    try {
      const response = await fetch("/api/analyze-bouquet", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ image:editing.image, scenes:scenes.map(scene => scene.name) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 识别暂时不可用");
      setAiDraft(data);
    } catch (error) { setAiError(error instanceof Error ? error.message : "AI 识别暂时不可用"); }
    finally { setAiLoading(false); }
  }

  function applyAiDraft(name = aiDraft?.nameCandidates[0]) {
    if (!aiDraft || !name) return;
    setBouquets(items => items.map(item => item.id === editing.id ? { ...item, name, color:aiDraft.colorTag, subtitle:aiDraft.subtitle, description:aiDraft.description, scenes:aiDraft.recommendedScenes.filter(scene => scenes.some(option => option.name === scene)) } : item));
    setSaved(false);
  }

  function renameScene(id: string, name: string) {
    const previous = scenes.find(scene => scene.id === id)?.name;
    setScenes(items => items.map(scene => scene.id === id ? { ...scene, name } : scene));
    if (previous) setBouquets(items => items.map(item => ({ ...item, scenes:item.scenes.map(scene => scene === previous ? name : scene) })));
    if (activeScene === previous) setActiveScene(name);
  }

  function addScene() {
    const id = `SC-${String(Date.now()).slice(-5)}`;
    setScenes(items => [...items, { id, name:"新场景", description:"点击填写场景说明", hidden:false }]);
    setSaved(false);
  }

  function addBouquet() {
    const sequence = bouquets.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, "")) || 0), 0) + 1;
    const id = `FL-${String(sequence).padStart(3, "0")}`;
    const next: Bouquet = { id, name:"新花礼", subtitle:"请填写一句话描述", image:"/demo/demo-1.png", price:"399–699", sizePrice:"0–200", materialPrice:"50–300", scenes:scenes[0] ? [scenes[0].name] : [], color:"待填写", description:"请填写花礼的详细介绍。" };
    setBouquets(items => [...items, next]);
    setEditingId(id);
    setSaved(false);
  }

  async function saveCatalog() {
    setSaved(false); setCatalogError("");
    try {
      const response = await fetch("/api/catalog", { method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ scenes, bouquets }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "保存失败");
      if (isCatalogState(payload.catalog)) {
        setScenes(payload.catalog.scenes);
        setBouquets(payload.catalog.bouquets);
      }
      setSaved(true);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "保存失败");
    }
  }

  function moveScene(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    setScenes(items => { const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  function deleteScene(id: string) {
    const scene = scenes.find(item => item.id === id);
    if (!scene) return;
    setScenes(items => items.filter(item => item.id !== id));
    setBouquets(items => items.map(item => ({ ...item, scenes:item.scenes.filter(name => name !== scene.name) })));
    if (activeScene === scene.name) setActiveScene("全部");
  }

  function openDetail(item: Bouquet) { setSelected(item); setSelectedSize("M"); setMaterial(0); }

  return (
    <main onClickCapture={event => { const target = event.target as HTMLElement; if (target.closest(".consult-button")) setConsultOpen(true); if (ownerMode && target.closest(".close-admin")) window.location.assign("/owner"); }}>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="HUAXULI FLORA 首页"><span className="brand-mark">H</span><span><strong>HUAXULI FLORA</strong><small>花礼选品手册</small></span></a>
        <nav aria-label="主导航"><a className="active" href="#collection">选花</a><a href="#guide">定制说明</a><a href="#about">关于我们</a></nav>
        <a className="outline-button" href="/owner">店主入口</a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> FLORAL SELECTION · 2026</div>
        <h1>为每一次见面，<br/><em>选一束恰好的花。</em></h1>
        <p>按场景、色系与预算慢慢挑选。每款花礼都提供体量参考、花材调整方案与透明的价格说明。</p>
        <a className="primary-button" href="#collection">开始选花 <span>↘</span></a>
        <div className="hero-note"><strong>01</strong><span>先选用花场景<br/>再看适合的成品花礼</span></div>
      </section>

      <section className="catalog" id="collection">
        <div className="section-heading"><div><span className="kicker">CURATED FOR THE MOMENT</span><h2>今天，想为什么送花？</h2></div><p>点选场景，找到更贴近当下心意的花束。</p></div>
        <div className="scene-filter" aria-label="使用场景筛选">{["全部", ...visibleScenes.map(scene => scene.name)].map(scene => <button onClick={() => setActiveScene(scene)} className={scene === activeScene ? "selected" : ""} key={scene}>{scene}</button>)}</div>
        <div className="demo-alert"><span>演示</span> 当前图片为功能测试素材，店主可在后台上传并替换真实花束照片。</div>
        {filtered.length === 0 ? <div className="empty-state">这个场景还没有上架花礼，店主可从后台添加。</div> : <div className="bouquet-grid">{filtered.map((bouquet,index) => <article className="bouquet-card" key={bouquet.id} onClick={() => openDetail(bouquet)}><div className="image-wrap"><img src={bouquet.image} alt={`${bouquet.name}演示图`} /><span className="card-number">{String(index+1).padStart(2,"0")}</span><button onClick={e => e.stopPropagation()} aria-label={`收藏${bouquet.name}`} className="favorite">♡</button></div><div className="card-body"><div className="card-title"><div><small>{bouquet.id}</small><h3>{bouquet.name}</h3></div><span>¥{bouquet.price}</span></div><p>{bouquet.subtitle}</p><div className="tag-row">{[...bouquet.scenes.slice(0,2),bouquet.color].map(tag => <span key={tag}>{tag.replace("花束","")}</span>)}</div><button className="detail-link">查看体量与花材方案 <span>→</span></button></div></article>)}</div>}
      </section>

      <section className="guide" id="guide"><span className="kicker">HOW CUSTOM PRICING WORKS</span><h2>价格不只由尺寸决定</h2><div className="guide-grid"><div><b>01</b><h3>整体参考价</h3><p>每款花礼给出完整参考区间，便于先判断是否符合预算。</p></div><div><b>02</b><h3>体量调整</h3><p>在风格和花材配方基本不变时，增减花量所带来的浮动。</p></div><div><b>03</b><h3>花材调整</h3><p>体量基本不变时，因时令、进口与稀缺花材产生的浮动。</p></div></div></section>

      <footer id="about"><div className="brand footer-brand"><span className="brand-mark">H</span><span><strong>HUAXULI FLORA</strong><small>花礼选品手册</small></span></div><p>预约与当日花材，请咨询门店花艺师。</p><span>MADE FOR BEAUTIFUL MOMENTS</span></footer>

      {consultOpen && selected && <ConsultationDialog bouquet={selected} size={selectedSize} materialPlan={materialPlans[material].title} onClose={()=>setConsultOpen(false)} />}

      {selected && <div className="modal-layer" role="dialog" aria-modal="true" aria-label={`${selected.name}详情`}><button className="modal-backdrop" onClick={() => setSelected(null)} aria-label="关闭"/><div className="detail-modal"><button className="close-button" onClick={() => setSelected(null)}>×</button><div className="detail-image"><img src={selected.image} alt={`${selected.name}演示图`}/><span>DEMO IMAGE</span></div><div className="detail-content"><small>{selected.id} · {selected.color}</small><h2>{selected.name}</h2><p className="detail-description">{selected.description}</p><section><div className="subhead"><h3>体量参考</h3><span>花材风格保持一致</span></div><div className="size-tabs">{Object.keys(sizeInfo).map(size => <button onClick={() => setSelectedSize(size)} className={size===selectedSize?"selected":""} key={size}>{size}</button>)}</div><p className="option-note">{sizeInfo[selectedSize]}</p></section><section><div className="subhead"><h3>花材方案</h3><span>体量基本不变</span></div><div className="material-tabs">{materialPlans.map((plan,i)=><button className={i===material?"selected":""} onClick={()=>setMaterial(i)} key={plan.title}><b>0{i+1}</b>{plan.title}</button>)}</div><p className="option-note">{materialPlans[material].text}</p></section><section className="price-panel"><div><span>整体参考价</span><strong>¥{selected.price}</strong></div><div><span>体量调整影响</span><strong>+¥{selected.sizePrice}</strong></div><div><span>花材调整影响</span><strong>±¥{selected.materialPrice}</strong></div><p>最终价格受当日花材、季节行情、花量、进口花材与包装复杂度影响，以花艺师确认方案为准。</p></section><button className="consult-button">记住这款，咨询店员 <span>↗</span></button></div></div></div>}

      {adminOpen && <div className="admin-shell" role="dialog" aria-modal="true" aria-label="店主编辑台"><aside><div className="admin-brand"><span className="brand-mark">F</span><div><strong>FLORA</strong><small>OWNER STUDIO</small></div></div><div className="admin-users"><span>协作店主</span><div><i>LW</i><i>CX</i><b>2 人在线</b></div></div><nav className="admin-nav"><button onClick={()=>setAdminView("bouquets")} className={adminView==="bouquets"?"selected":""}>花礼管理 <span>{bouquets.length}</span></button><button onClick={()=>setAdminView("scenes")} className={adminView==="scenes"?"selected":""}>场景管理 <span>{scenes.length}</span></button><button disabled>展示设置</button></nav><p className="preview-warning">云端目录<br/><span>{catalogLoading?"正在读取…":"保存后顾客页同步更新。"}</span></p></aside><div className="admin-main"><header><div><small>{adminView==="bouquets"?"BOUQUET LIBRARY":"SCENE LIBRARY"}</small><h2>{adminView==="bouquets"?"花礼管理":"场景管理"}</h2></div><button className="close-admin" onClick={()=>setAdminOpen(false)}>返回顾客页 ×</button></header>{catalogError&&<div className="owner-empty error">{catalogError}</div>}{adminView==="bouquets" ? <div className="admin-workspace"><div className="admin-list"><button type="button" className="add-card" onClick={addBouquet}>+　新增花礼</button>{bouquets.map(item=><button onClick={()=>setEditingId(item.id)} className={item.id===editing.id?"selected":""} key={item.id}><img src={item.image} alt=""/><span><small>{item.id}</small><b>{item.name}</b><em>已上架</em></span></button>)}</div>{editing&&<form className="editor" onSubmit={async e=>{e.preventDefault();await saveCatalog()}}><div className="editor-head"><div><span className="status-dot"/>正在编辑　{editing.id}</div><button type="submit">{saved?"已保存":"保存更改"}</button></div><div className="editor-grid"><label>花礼名称<input value={editing.name} onChange={e=>updateEditing("name",e.target.value)}/></label><label>色系标签<input value={editing.color} onChange={e=>updateEditing("color",e.target.value)}/></label><label className="full">一句话描述<input value={editing.subtitle} onChange={e=>updateEditing("subtitle",e.target.value)}/></label><label className="full">详细介绍<textarea value={editing.description} onChange={e=>updateEditing("description",e.target.value)}/></label><div className="full upload-field"><span>封面图片</span><div><img src={editing.image} alt="封面预览"/><label className="upload-button">上传新图片<input type="file" accept="image/*" onChange={uploadPreview}/></label><button type="button" className="ai-button" onClick={analyzeImage} disabled={aiLoading}>{aiLoading?"正在识别…":"AI 识图生成文案"}</button><small>上传后由 AI 生成草稿，确认后再应用</small></div>{aiError&&<p className="ai-error">{aiError}</p>}{aiDraft&&<div className="ai-draft"><div><span>AI 文案草稿</span><small>{aiDraft.confidenceNote}</small></div><p>名称候选</p><div className="name-candidates">{aiDraft.nameCandidates.map(name=><button type="button" onClick={()=>applyAiDraft(name)} key={name}>{name}</button>)}</div><dl><div><dt>色系</dt><dd>{aiDraft.colorTag}</dd></div><div><dt>一句话</dt><dd>{aiDraft.subtitle}</dd></div><div><dt>推荐场景</dt><dd>{aiDraft.recommendedScenes.join("、")||"暂不推荐"}</dd></div><div><dt>识别到的花材</dt><dd>{aiDraft.flowerHints.join("、")||"仅供花艺师确认"}</dd></div></dl><button type="button" className="apply-ai" onClick={()=>applyAiDraft()}>应用首选草稿</button></div>}</div><fieldset className="full"><legend>价格信息</legend><label>整体参考价<input value={editing.price} onChange={e=>updateEditing("price",e.target.value)}/></label><label>体量影响<input value={editing.sizePrice} onChange={e=>updateEditing("sizePrice",e.target.value)}/></label><label>花材影响<input value={editing.materialPrice} onChange={e=>updateEditing("materialPrice",e.target.value)}/></label></fieldset><fieldset className="full scene-checks"><legend>所属场景（可多选）</legend>{scenes.map(scene=><label key={scene.id}><input type="checkbox" checked={editing.scenes.includes(scene.name)} onChange={e=>updateEditing("scenes",e.target.checked?[...editing.scenes,scene.name]:editing.scenes.filter(s=>s!==scene.name))}/>{scene.name}{scene.hidden?"（已隐藏）":""}</label>)}</fieldset></div></form>}</div> : <div className="scene-manager"><div className="scene-manager-head"><div><h3>自定义顾客筛选场景</h3><p>顺序会同步到顾客页；隐藏不会删除已关联花礼。</p></div><div><button onClick={addScene}>+ 新增场景</button><button onClick={saveCatalog}>{saved?"已保存":"保存场景"}</button></div></div><div className="scene-table">{scenes.map((scene,index)=><article key={scene.id}><span className="drag-index">{String(index+1).padStart(2,"0")}</span><div className="scene-fields"><label>场景名称<input value={scene.name} onChange={e=>{renameScene(scene.id,e.target.value);setSaved(false)}}/></label><label>场景说明<input value={scene.description} onChange={e=>{setScenes(items=>items.map(item=>item.id===scene.id?{...item,description:e.target.value}:item));setSaved(false)}}/></label></div><div className="scene-actions"><label className="visibility"><input type="checkbox" checked={!scene.hidden} onChange={e=>{setScenes(items=>items.map(item=>item.id===scene.id?{...item,hidden:!e.target.checked}:item));setSaved(false)}}/><span>{scene.hidden?"已隐藏":"顾客可见"}</span></label><div><button onClick={()=>moveScene(index,-1)} disabled={index===0} aria-label="上移">↑</button><button onClick={()=>moveScene(index,1)} disabled={index===scenes.length-1} aria-label="下移">↓</button><button className="delete-scene" onClick={()=>deleteScene(scene.id)}>删除</button></div></div></article>)}</div></div>}</div></div>}
    </main>
  );
}
