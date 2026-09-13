import { useState } from 'react'
import { BrowserRouter, Link, Routes, Route, useLocation } from 'react-router-dom'
import { create } from 'zustand'
import { nanoid } from 'nanoid'
import clsx from 'clsx'
import styles from './Card.module.css'
import './App.css'
const useCounter = create<{count:number;add:()=>void}>(set => ({count:0,add:()=>set(state=>({count:state.count+1}))}))
function Kitchen() {
  const {count,add}=useCounter(), [identity]=useState(()=>nanoid(8)), location=useLocation()
  return <main className={clsx('p-8 bg-brand',styles.card)}><h1>Profile kitchen</h1><p>Runtime identity: {identity}</p><button onClick={add}>Count is {count}</button><nav><Link to="/recipes/42?tab=notes#details">Recipe 42</Link><Link to="/">Home</Link></nav><Routes><Route path="/" element={<h2>Everyday recipes</h2>}/><Route path="/recipes/:id" element={<h2>Recipe details</h2>}/></Routes><p>{location.pathname}{location.search}{location.hash}</p><img src="/plate.svg" width="48" height="48" alt="Plate" /></main>
}
export default function App() { return <BrowserRouter><Kitchen /></BrowserRouter> }
