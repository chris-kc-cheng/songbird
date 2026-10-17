export const songs = [
 {title:'海闊天空',artist:'Beyond',year:1993,color:'#809b9c'},
 {title:'追',artist:'張國榮',year:1994,color:'#a78979'},
 {title:'約定',artist:'王菲',year:1997,color:'#8996ab'},
 {title:'富士山下',artist:'陳奕迅',year:2006,color:'#8b9f91'},
 {title:'囍帖街',artist:'謝安琪',year:2008,color:'#bf947a'},
 {title:'年少無知',artist:'林保怡 · 陳豪 · 黃德斌',year:2011,color:'#a5a180'}
];
export const demo = ['C4','E4','G4','E4','D4','F4','A4','G4','E4','D4','C4','E4','D4','G4','E4','C4'];
export const names=['C','D','E','F','G','A','B'];
export function midi(note){const m=/^([A-G])(#?)([3-5])$/.exec(note);if(!m)throw Error('Use notes C3–B5, for example C4 or F#4.');return 12*(+m[3]+1)+({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]])+(m[2]?1:0);}
export function parseScore(value){const notes=value.trim().split(/[\s,]+/);if(notes.length<2||notes.length>128)throw Error('Enter between 2 and 128 notes.');notes.forEach(midi);return notes;}
export function frequency(note){return 440*2**((midi(note)-69)/12);}
