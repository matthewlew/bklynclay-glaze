// ── GLAZE DATA ────────────────────────────────────────────────────────────────
export const CLAY = { white:'#E2DDD6', red:'#7A3828' };

export const GLAZES = [
  {name:'Mary',                   hex:'#C8788A',fin:'matte',        hue:345,sat:.36,lum:.63,trans:0},
  {name:'Alice',                  hex:'#D4A0A8',fin:'matte',        hue:350,sat:.30,lum:.73,trans:0},
  {name:'Jerry',                  hex:'#B898C8',fin:'matte',        hue:280,sat:.26,lum:.69,trans:0},
  {name:'Lucy',                   hex:'#9898C4',fin:'matte',        hue:240,sat:.28,lum:.68,trans:0},
  {name:'Mike',                   hex:'#90B8D0',fin:'matte',        hue:200,sat:.38,lum:.68,trans:0},
  {name:'Robin',                  hex:'#68A8CC',fin:'shiny',        hue:200,sat:.45,lum:.61,trans:0},
  {name:'Pau',                    hex:'#3888C0',fin:'shiny',        hue:210,sat:.57,lum:.48,trans:0},
  {name:'Larry',                  hex:'#2850A8',fin:'shiny',        hue:224,sat:.62,lum:.41,trans:0},
  {name:'Chuck',                  hex:'#3058B0',fin:'shiny',        hue:222,sat:.55,lum:.44,trans:0},
  {name:'Linda',                  hex:'#185870',fin:'shiny',        hue:196,sat:.62,lum:.27,trans:0},
  {name:'Miquel',                 hex:'#385830',fin:'matte',        hue:108,sat:.30,lum:.26,trans:0},
  {name:'Song',                   hex:'#7AA870',fin:'matte',        hue:108,sat:.26,lum:.55,trans:0},
  {name:'Lake',                   hex:'#5A9848',fin:'shiny',        hue:104,sat:.35,lum:.44,trans:0},
  {name:'Apple',                  hex:'#88B820',fin:'shiny',        hue: 82,sat:.70,lum:.42,trans:0},
  {name:'Ron',                    hex:'#D8C818',fin:'shiny',        hue: 55,sat:.78,lum:.47,trans:0},
  {name:'Maria',                  hex:'#B0A820',fin:'matte',        hue: 57,sat:.69,lum:.40,trans:0},
  {name:'Ernie',                  hex:'#D06020',fin:'matte',        hue: 24,sat:.72,lum:.47,trans:0},
  {name:'Poppy',                  hex:'#C84840',fin:'matte',        hue:  3,sat:.55,lum:.52,trans:0},
  {name:'Fabio',                  hex:'#A01828',fin:'shiny',        hue:  5,sat:.73,lum:.36,trans:0},
  {name:'Breaking Dawn: Part II', hex:'#7880A0',fin:'matte',        hue:228,sat:.18,lum:.54,trans:0},
  {name:'Thunder 2',              hex:'#1C1008',fin:'shiny',        hue: 24,sat:.45,lum:.08,trans:.28},
  {name:'Lucille 2',              hex:'#141414',fin:'matte',        hue:  0,sat:0,  lum:.08,trans:0},
  {name:'Clear',                  hex:'#E2DDD6',fin:'transparent',  hue: 35,sat:.08,lum:.88,trans:.92},
  {name:'Claire',                 hex:'#DDD8D0',fin:'crawl-crackle',hue: 35,sat:.08,lum:.85,trans:.80},
  {name:'Karin',                  hex:'#DDD8CC',fin:'matte',        hue: 40,sat:.12,lum:.83,trans:0},
  {name:'Kahlil',                 hex:'#C8C8C8',fin:'shiny',        hue:  0,sat:0,  lum:.78,trans:.15},
  {name:'Whiplash',               hex:'#D0CBC4',fin:'shiny',        hue: 30,sat:.09,lum:.80,trans:.25},
  {name:'Walt',                   hex:'#D8D5CE',fin:'matte',        hue: 40,sat:.08,lum:.83,trans:0},
  {name:'Jane',                   hex:'#E0E0E0',fin:'crawl-dot',    hue:  0,sat:0,  lum:.88,trans:.10},
  {name:'Ramesh',                 hex:'#C8C0B0',fin:'textured',     hue: 35,sat:.14,lum:.73,trans:0},
  {name:'Norm',                   hex:'#9098A8',fin:'matte',        hue:214,sat:.12,lum:.62,trans:0},
  {name:'Hans',                   hex:'#705848',fin:'matte',        hue: 22,sat:.22,lum:.36,trans:0},
  {name:'Pasqual',                hex:'#B07820',fin:'shiny',        hue: 38,sat:.70,lum:.41,trans:0},
  {name:'Guido',                  hex:'#1C0C04',fin:'shiny',        hue: 20,sat:.68,lum:.07,trans:0,special:'gold-flake'},
  {name:'Van',                    hex:'#581C10',fin:'shiny',        hue: 12,sat:.68,lum:.21,trans:.20},
  {name:'Lotta',                  hex:'#384058',fin:'matte',        hue:220,sat:.22,lum:.28,trans:0},
  {name:'Lars',                   hex:'#080808',fin:'shiny',        hue:  0,sat:0,  lum:.03,trans:0},
  {name:'Louise',                 hex:'#101010',fin:'crawl-leather',hue:  0,sat:0,  lum:.06,trans:0},
];

export const NL = GLAZES.map(g => ({ g, lc: g.name.toLowerCase() }));

export const LEVERS = [
  { key:'temp',  leftLabel:'Warm',   rightLabel:'Cool',      leftColor:'#c87030', rightColor:'#4890c0' },
  { key:'depth', leftLabel:'Light',  rightLabel:'Dark',      leftColor:'#e0dbd2', rightColor:'#181818' },
  { key:'char',  leftLabel:'Quiet',  rightLabel:'Saturated', leftColor:'#b0acaa', rightColor:'#c84010' },
];

export const PRESETS = {
  turrell:  { temp:40, depth:30, char:5  },
  rothko:   { temp:35, depth:70, char:80 },
  albers:   { temp:50, depth:55, char:90 },
  martin:   { temp:45, depth:20, char:5  },
  kelly:    { temp:50, depth:50, char:95 },
  judd:     { temp:50, depth:60, char:25 },
  eliasson: { temp:65, depth:45, char:45 },
  wada:     { temp:50, depth:50, char:30 },
};
