export type Bouquet = {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  price: string;
  sizePrice: string;
  materialPrice: string;
  scenes: string[];
  color: string;
  description: string;
};

export type Scene = { id: string; name: string; description: string; hidden: boolean };
export type CatalogState = { scenes: Scene[]; bouquets: Bouquet[] };

export const initialScenes: Scene[] = [
  { id:"SC-01", name:"见面花束", description:"初次见面、探访与轻松约会", hidden:false },
  { id:"SC-02", name:"订婚花束", description:"求婚、订婚与重要承诺", hidden:false },
  { id:"SC-03", name:"结婚手捧花", description:"婚礼仪式与新娘手捧", hidden:false },
  { id:"SC-04", name:"婚车花礼", description:"婚车装饰与迎亲花礼", hidden:false },
  { id:"SC-05", name:"表白花束", description:"告白与浪漫纪念", hidden:false },
  { id:"SC-06", name:"男生花束", description:"克制、利落的男性向花礼", hidden:false },
  { id:"SC-07", name:"生日花束", description:"生日祝福与庆祝", hidden:false },
];

export const initialBouquets: Bouquet[] = [
  { id:"FL-001", name:"雾林来信", subtitle:"低饱和白绿系 · 自然风手扎", image:"/demo/demo-1.png", price:"399–899", sizePrice:"0–200", materialPrice:"50–300", scenes:["见面花束","生日花束"], color:"白绿系", description:"以清透的白绿层次表达自然且克制的心意，适合初次见面、生日或日常纪念。" },
  { id:"FL-002", name:"暮色花园", subtitle:"烟粉与浆果色 · 浪漫花园感", image:"/demo/demo-2.png", price:"599–1299", sizePrice:"100–350", materialPrice:"80–450", scenes:["订婚花束","表白花束"], color:"雾粉系", description:"像日落后的花园，温柔却有层次。适合订婚、表白与较正式的纪念日。" },
  { id:"FL-003", name:"青屿日落", subtitle:"灰蓝与奶油色 · 克制现代感", image:"/demo/demo-3.png", price:"459–999", sizePrice:"0–250", materialPrice:"60–380", scenes:["男生花束","见面花束"], color:"灰蓝系", description:"线条利落、色彩克制，不过分甜腻的现代花礼，适合男生或偏爱极简风格的收花人。" },
  { id:"FL-004", name:"月光誓言", subtitle:"奶白与雾粉 · 典礼感手捧", image:"/demo/demo-2.png", price:"899–1699", sizePrice:"150–400", materialPrice:"100–600", scenes:["结婚手捧花","订婚花束"], color:"奶油系", description:"圆润、轻盈且上镜的仪式花礼，可根据礼服面料、婚礼环境与新娘身高调整比例。" },
];

export const initialCatalog: CatalogState = { scenes: initialScenes, bouquets: initialBouquets };

export function isCatalogState(value: unknown): value is CatalogState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<CatalogState>;
  if (!Array.isArray(state.scenes) || !Array.isArray(state.bouquets) || state.scenes.length > 100 || state.bouquets.length > 500) return false;
  return state.scenes.every(scene => scene && typeof scene.id === "string" && typeof scene.name === "string" && typeof scene.description === "string" && typeof scene.hidden === "boolean") &&
    state.bouquets.every(bouquet => bouquet && typeof bouquet.id === "string" && typeof bouquet.name === "string" && typeof bouquet.subtitle === "string" && typeof bouquet.image === "string" && typeof bouquet.price === "string" && typeof bouquet.sizePrice === "string" && typeof bouquet.materialPrice === "string" && Array.isArray(bouquet.scenes) && bouquet.scenes.every(scene => typeof scene === "string") && typeof bouquet.color === "string" && typeof bouquet.description === "string");
}
