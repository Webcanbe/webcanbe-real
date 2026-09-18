import {Routes,Route,NavLink} from 'react-router-dom'
import Dashboard from '@/pages/Dashboard'
import Archive from '@/pages/Archive'
import mark from '@/assets/mark.svg'
export default function App(){return <div className='max-w-5xl mx-auto'><header className='p-6 flex items-center justify-between'><div className='flex items-center gap-4'><img src={mark} width='32' alt='Studio Ledger mark'/><strong>Studio Ledger</strong></div><nav className='flex gap-6'><NavLink to='/'>This week</NavLink><NavLink to='/archive'>Archive</NavLink></nav></header><Routes><Route path='/' element={<Dashboard/>}/><Route path='/archive' element={<Archive/>}/></Routes></div>}
