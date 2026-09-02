const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
const L=h=>{const[r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return .2126*lin(r)+.7152*lin(g)+.0722*lin(b)};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return((x+.05)/(y+.05)).toFixed(2)};
const t={canvas:'#FAF9F8',sunk:'#F2F0EE',ink950:'#14100F',accent:'#1B4D5C',accent50:'#EFF6F8',white:'#FFFFFF',ink700:'#1F1F23',ink500:'#45454F',ink300:'#6E6E79',brand:'#CF3429',brand700:'#8E211A'};
const chk=[
 ['ink-700 on canvas',t.ink700,t.canvas],['ink-500 on canvas',t.ink500,t.canvas],
 ['ink-300 on canvas',t.ink300,t.canvas],['ink-300 on sunk',t.ink300,t.sunk],
 ['ink-950 on canvas',t.ink950,t.canvas],
 ['accent on white',t.accent,t.white],['accent on canvas',t.accent,t.canvas],
 ['accent on accent-50',t.accent,t.accent50],['white on accent',t.white,t.accent],
 ['brand-700 on canvas',t.brand700,t.canvas],['white on brand',t.white,t.brand],
];
for(const[n,f,b]of chk){const r=+R(f,b);console.log((r>=4.5?'PASS':r>=3?'LARGE-ONLY':'FAIL').padEnd(11),r.toFixed(2).padStart(6),' ',n)}
