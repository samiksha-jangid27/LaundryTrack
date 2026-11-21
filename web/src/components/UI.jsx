import {AlertCircle,Check,LoaderCircle,Shirt,PackageCheck} from 'lucide-react';
import {STAGE_LABELS} from '@laundrytrack/core';
export function Brand(){return <span className="brand"><span className="brand-icon"><Shirt size={23}/></span>Laundry<span className="brand-light">Track</span></span>;}
export function Button({children,busy,variant='',className='',...props}){return <button className={`button ${variant} ${className}`} disabled={busy||props.disabled} {...props}>{busy?<LoaderCircle className="spin" size={18}/>:null}{children}</button>;}
export function Badge({stage}){return <span className={`badge ${['delivered','ready'].includes(stage)?'success':stage==='cancelled'?'muted':'progress'}`}>{STAGE_LABELS[stage]||stage}</span>;}
export function ErrorBox({error}){return error?<div className="notice error" role="alert"><AlertCircle size={19}/><span>{error.message||error}</span></div>:null;}
export function Notice({children}){return <div className="notice"><Check size={19}/><span>{children}</span></div>;}
export function Empty({title='A fresh start',children,action}){return <div className="empty"><PackageCheck size={38} strokeWidth={1.4}/><h3>{title}</h3><p>{children}</p>{action}</div>;}
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin"/>Getting everything in order…</div>;}
export function Field({label,hint,children}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Metric({label,value,detail,icon:Icon}){return <div className="metric"><div className="metric-top"><span>{label}</span>{Icon&&<Icon size={20}/>}</div><strong>{value}</strong>{detail&&<small>{detail}</small>}</div>;}
export function PageHeading({eyebrow,title,children,action}){return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children&&<p className="lead">{children}</p>}</div>{action}</div>;}
