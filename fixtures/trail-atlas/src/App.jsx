import {Routes,Route,NavLink} from 'react-router-dom'
import Home from './pages/Home'
import Guides from './pages/Guides'
import './base.css'
export default function App(){return <><header><strong>Trail Atlas</strong><nav><NavLink to='/'>Discover</NavLink><NavLink to='/guides'>Field guides</NavLink></nav></header><Routes><Route path='/' element={<Home/>}/><Route path='/guides' element={<Guides/>}/></Routes><footer>Independent walking notes · Updated each season</footer></>}
