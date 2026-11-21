import Constants from 'expo-constants';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
const fallbackHost=Constants.expoConfig?.hostUri?.split(':')[0]||(Platform.OS==='android'?'10.0.2.2':'localhost');
let baseUrl=process.env.EXPO_PUBLIC_API_URL||`http://${fallbackHost}:4000`;
let token=null;
export const secret={get:async key=>Platform.OS==='web'?sessionStorage.getItem(key):SecureStore.getItemAsync(key),set:async(key,value)=>Platform.OS==='web'?sessionStorage.setItem(key,value):SecureStore.setItemAsync(key,value),remove:async key=>Platform.OS==='web'?sessionStorage.removeItem(key):SecureStore.deleteItemAsync(key)};
export const setToken=value=>{token=value;};
export const getBaseUrl=()=>baseUrl;
export async function setBaseUrl(value){const parsed=new URL(value);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('Enter a plain http or https API address.');baseUrl=value.replace(/\/$/,'');await secret.set('laundrytrack.api',baseUrl);}
export async function restoreBaseUrl(){const saved=await secret.get('laundrytrack.api');if(saved)baseUrl=saved;}
export async function api(path,{method='GET',body}={}){const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(baseUrl+'/api'+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});}catch{const error=new Error('Cannot reach the outlet. Check your connection or API address.');error.offline=true;throw error;}finally{clearTimeout(timeout);}if(response.status===204)return null;const data=await response.json();if(!response.ok){const error=new Error(data.error||'Request failed');error.status=response.status;throw error;}return data;}
