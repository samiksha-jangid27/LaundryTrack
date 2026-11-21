// Browser preview adapter. Native builds use SQLite, not browser storage.
export const cacheGet=key=>JSON.parse(sessionStorage.getItem('lt.cache.'+key)||'null');
export const cacheSet=(key,value)=>sessionStorage.setItem('lt.cache.'+key,JSON.stringify(value));
export const listPending=userId=>JSON.parse(sessionStorage.getItem('lt.queue.'+userId)||'[]');
export const addPending=(userId,action)=>{const rows=listPending(userId);if(!rows.some(r=>r.body.eventId===action.body.eventId))rows.push(action);sessionStorage.setItem('lt.queue.'+userId,JSON.stringify(rows));};
export const removePending=id=>{for(const key of Object.keys(sessionStorage).filter(k=>k.startsWith('lt.queue.')))sessionStorage.setItem(key,JSON.stringify(JSON.parse(sessionStorage.getItem(key)).filter(r=>r.body.eventId!==id)));};
export const clearLocal=userId=>{for(const key of Object.keys(sessionStorage).filter(k=>k.startsWith(`lt.cache.${userId}:`)||k==='lt.queue.'+userId))sessionStorage.removeItem(key);};
