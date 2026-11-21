import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../src/db.js';
import {seedCatalog} from '../src/catalog.js';
import {createApp} from '../src/app.js';
import {hashPassword} from '../src/auth.js';
export async function fixture(t){const db=openDatabase(':memory:');migrate(db);seedCatalog(db);const users={};for(const role of ['customer','staff','owner']){const id=randomUUID();db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(id,role,`${role}@test.example`,'9876543210',role,hashPassword('test-password-123'),new Date().toISOString());users[role]={id};}const server=createApp(db).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();});const base=`http://127.0.0.1:${server.address().port}`;
 async function request(path,{method='GET',body,token}={}){const r=await fetch(base+'/api'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.status===204?null:await r.json()};}
 for(const role of Object.keys(users)){const r=await request('/auth/login',{method:'POST',body:{email:`${role}@test.example`,password:'test-password-123'}});users[role].token=r.data.token;}
 const customer=(path,options={})=>request(path,{token:users.customer.token,...options});const staff=(path,options={})=>request(path,{token:users.staff.token,...options});
 async function book(quantity=2){const r=await customer('/orders',{method:'POST',body:{address:'Test street 123',phone:'9876543210',pickupDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),slot:'09:00–12:00',items:[{serviceId:'wash-fold',quantity}]}});if(r.status!==201)throw new Error(JSON.stringify(r));return r.data.order;}
 const action=(order,values={})=>({eventId:randomUUID(),version:order.version,...values});
 async function mutate(order,route,values={},actor=staff){const r=await actor(`/orders/${order.id}/${route}`,{method:'POST',body:action(order,values)});if(r.status!==200&&r.status!==201)throw new Error(JSON.stringify(r));return r.data.order;}
 return {db,users,request,customer,staff,book,action,mutate};}
