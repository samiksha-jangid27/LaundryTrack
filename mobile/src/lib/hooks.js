import {useState,useCallback} from 'react';
import {useFocusEffect} from 'expo-router';
import {api} from './api';
import {cacheGet,cacheSet} from './storage';
import {useSession} from './session';
export function useResource(path){const {user}=useSession();const key=`${user?.id}:${path}`;const [data,setData]=useState(null);const [error,setError]=useState(null);const [loading,setLoading]=useState(true);const [refreshing,setRefreshing]=useState(false);const [offline,setOffline]=useState(false);const reload=useCallback(async()=>{if(!user)return;setRefreshing(true);try{const result=await api(path);setData(result);cacheSet(key,result);setError(null);setOffline(false);return result;}catch(e){const cached=cacheGet(key);if(cached){setData(cached);setOffline(true);}setError(e);}finally{setLoading(false);setRefreshing(false);}},[path,key,user]);useFocusEffect(useCallback(()=>{const cached=cacheGet(key);if(cached){setData(cached);setLoading(false);}reload();},[key,reload]));const update=next=>{setData(next);cacheSet(key,next);};return {data,setData:update,error,loading,refreshing,reload,offline};}
