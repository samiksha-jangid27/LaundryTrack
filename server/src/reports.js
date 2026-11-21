import {Router} from 'express';
import {owner} from './auth.js';
export function reportsRouter(db){const router=Router();
 router.get('/staff',(req,res)=>res.json({staff:db.prepare("SELECT id,name,role FROM users WHERE role IN ('staff','owner') ORDER BY name").all()}));
 router.get('/summary',(req,res)=>{const counts=db.prepare('SELECT stage,COUNT(*) count,SUM(total) total FROM orders GROUP BY stage').all();const openIssues=db.prepare("SELECT COUNT(*) count FROM issues WHERE status='open'").get().count;const garmentCount=db.prepare('SELECT COUNT(*) count FROM garments WHERE delivered=0').get().count;res.json({counts,openIssues,garmentCount});});
 router.get('/export',owner,(req,res)=>{const rows=db.prepare('SELECT number,stage,pickup_date,total,expected_count,created_at FROM orders ORDER BY created_at DESC').all();const escape=v=>`"${String(v).replaceAll('"','""')}"`;res.attachment('laundrytrack-orders.csv').type('text/csv').send(['Order,Stage,Pickup,Total (paise),Items,Created',...rows.map(r=>Object.values(r).map(escape).join(','))].join('\n'));});
 return router;
}
