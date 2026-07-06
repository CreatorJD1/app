export const CATEGORIES = {
  face: "Face", eye: "Eyes", eyelash: "Eyelash", eyebrow: "Eyebrow", mouth: "Mouth",
  skin: "Body Skin", hair: "Hair",
  tops: "Tops", bottoms: "Bottoms", shoes: "Shoes", outerwear: "Outerwear", onepiece: "One-piece",
  accessory: "Accessory", glasses: "Glasses", other: "Other",
};

const RULES = [
  { cat: "eye", kw: ["eye_iris", "eyeiris", "_iris", "iris_", "_eye_", "_eye0", "_eye1", "eyewhite", "eye_extra", "eye_hi"] },
  { cat: "eyelash", kw: ["eyelash", "lash"] },
  { cat: "eyebrow", kw: ["eyebrow", "brow"] },
  { cat: "mouth", kw: ["mouth", "lip", "tongue", "teeth"] },
  { cat: "face", kw: ["face"] },
  { cat: "hair", kw: ["hair"] },
  { cat: "onepiece", kw: ["onepiece", "dress", "leotard"] },
  { cat: "outerwear", kw: ["coat", "cape", "cloak", "cardigan", "outer"] },
  { cat: "tops", kw: ["tops", "shirt", "jacket", "blouse", "top_", "top0", "top1"] },
  { cat: "bottoms", kw: ["bottoms", "pants", "skirt", "short", "trouser", "bottom_"] },
  { cat: "shoes", kw: ["shoe", "boot", "sneaker", "foot"] },
  { cat: "glasses", kw: ["glass", "goggle"] },
  { cat: "accessory", kw: ["accessory", "acc_", "acce_", "ribbon", "necklace", "earring", "hat", "crown", "hairornament", "horn", "tail", "wings"] },
  { cat: "skin", kw: ["skin", "body"] },
];

export function classifyMaterial(name) {
  if (!name) return "other";
  const s = String(name).toLowerCase();
  for (const r of RULES) if (r.kw.some((k) => s.includes(k))) return r.cat;
  return "other";
}

export function groupMaterialsByCategory(materials) {
  const groups = {};
  (materials || []).forEach((m) => {
    const cat = classifyMaterial(m.name);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(m);
  });
  return groups;
}

export const CATEGORY_META = {
  hair: { label: "Hair", kind: "hair", prompt: "anime hair strands with soft cel-shaded highlights, tileable" },
  eye: { label: "Eyes", kind: "eye", prompt: "detailed anime iris, centered, glossy highlight" },
  eyelash: { label: "Eyelash", kind: "pattern", prompt: "thin anime eyelash strokes on transparent, black" },
  eyebrow: { label: "Eyebrow", kind: "pattern", prompt: "anime eyebrow shape, thin clean lineart" },
  mouth: { label: "Mouth", kind: "pattern", prompt: "anime mouth expressions sheet on white" },
  face: { label: "Face", kind: "skin", prompt: "soft anime face skin, subtle pastel blush" },
  skin: { label: "Body Skin", kind: "skin", prompt: "soft anime body skin, smooth pastel gradient, tileable" },
  tops: { label: "Tops", kind: "texture", prompt: "anime top clothing texture, cel-shaded fabric, tileable" },
  bottoms: { label: "Bottoms", kind: "texture", prompt: "anime bottoms fabric texture, tileable" },
  shoes: { label: "Shoes", kind: "texture", prompt: "anime shoes / boots material, tileable" },
  outerwear: { label: "Outerwear", kind: "texture", prompt: "anime outerwear fabric, cel-shaded, tileable" },
  onepiece: { label: "One-piece", kind: "texture", prompt: "anime one-piece dress texture, cel-shaded, tileable" },
  accessory: { label: "Accessory", kind: "pattern", prompt: "anime accessory decorative texture, glossy, tileable" },
  glasses: { label: "Glasses", kind: "pattern", prompt: "anime glasses lens tint, subtle sheen" },
  other: { label: "Other", kind: "texture", prompt: "anime detail texture, tileable" },
};
