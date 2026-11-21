import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {authRouter,authenticate,operator} from './auth.js';
import {orderRouter} from './order-routes.js';
import {reportsRouter} from './reports.js';
import {getCatalog} from './catalog.js';
import {errorHandler} from './errors.js';
export function createApp(db,{demo=false}={}){const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{'img-src':["'self'",'data:','blob:']}}}));const origins=(process.env.WEB_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081').split(',');app.use(cors({origin:(origin,callback)=>callback(null,!origin||origins.includes(origin)),credentials:false}));app.use(express.json({limit:'32kb'}));app.get('/api/health',(req,res)=>res.json({status:'ok',demo,version:'1.0.0'}));app.get('/api/services',(req,res)=>res.json({services:getCatalog(db)}));app.use('/api/auth',authRouter(db));app.use('/api/orders',authenticate(db),orderRouter(db));app.use('/api/outlet',authenticate(db),operator,reportsRouter(db));app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found'}));const web=fileURLToPath(new URL('../../web/dist',import.meta.url));if(existsSync(web)){app.use(express.static(web));app.get('/{*path}',(req,res)=>res.sendFile(`${web}/index.html`));}app.use(errorHandler);return app;}
