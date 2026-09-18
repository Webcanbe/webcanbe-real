import {BrowserRouter, Routes, Route, Link, Outlet} from 'react-router-dom'
import {Place} from './pages/Place'
import banner from './assets/coast.svg'
import './styles.css'
function Shell(){return <><header><strong>COAST PATHS</strong><nav><Link to="/">Home</Link><Link to="/places/42?mode=quiet#details">Visit the headland</Link><Link to="/places/7?mode=busy">Visit the harbor</Link><Link to="/not-on-the-map">Unknown place</Link></nav></header><Outlet/><footer>Take the longer way home.</footer></>}
function Home(){return <main className="home"><p>A LOCAL FIELD GUIDE</p><h1>A coast worth exploring.</h1><img src={banner} alt="Coast illustration"/><img src="/compass.svg" alt="Public compass"/><Link to="/places/42?mode=quiet#details">Explore place 42</Link></main>}
function Missing(){return <main><h1>This place is not on our map.</h1><Link to="/">Back to the coast</Link></main>}
export function App(){return <BrowserRouter><Routes><Route element={<Shell/>}><Route index element={<Home/>}/><Route path="places" element={<Outlet/>}><Route path=":placeId" element={<Place/>}/></Route><Route path="*" element={<Missing/>}/></Route></Routes></BrowserRouter>}
