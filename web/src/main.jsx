import React,{useState,useEffect,Component} from 'react';
import {createRoot} from 'react-dom/client';
import {canOperate} from '@laundrytrack/core';
import {SessionProvider,useSession} from './session';
import {Shell} from './components/Shell';
import {Loading,ErrorBox,Button} from './components/UI';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Orders from './pages/Orders';
import Booking from './pages/Booking';
import OrderDetail from './pages/OrderDetail';
import Reports from './pages/Reports';
import './styles.css';
class ErrorBoundary extends Component{state={error:null};static getDerivedStateFromError(error){return {error};}render(){return this.state.error?<div className="empty"><h1>Let’s give that a fresh start.</h1><p>The screen could not load. Your saved orders are safe.</p><Button onClick={()=>window.location.reload()}>Reload LaundryTrack</Button></div>:this.props.children;}}
function App(){const {user,loading}=useSession();const [route,setRoute]=useState(location.hash.slice(1)||'home');useEffect(()=>{const update=()=>{setRoute(location.hash.slice(1)||'home');window.scrollTo(0,0);};window.addEventListener('hashchange',update);return()=>window.removeEventListener('hashchange',update);},[]);if(loading)return <Loading/>;if(!user)return <Auth/>;let content;if(route==='home')content=<Home/>;else if(route==='orders')content=<Orders/>;else if(route==='book'&&!canOperate(user))content=<Booking/>;else if(route==='reports'&&canOperate(user))content=<Reports/>;else if(route.startsWith('orders/'))content=<OrderDetail key={route} id={route.slice(7)}/>;else content=<div className="empty"><h1>This page isn’t here.</h1><a className="button" href="#home">Back to overview</a></div>;return <Shell route={route}>{content}</Shell>;}
createRoot(document.getElementById('root')).render(<ErrorBoundary><SessionProvider><App/></SessionProvider></ErrorBoundary>);
