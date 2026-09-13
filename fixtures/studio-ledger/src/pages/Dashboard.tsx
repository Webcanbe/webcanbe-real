import {clsx as cn} from 'clsx'
import Metric from '@/components/Metric'
import projects from '@/data/projects.json'
export default function Dashboard(){return <main className={cn('p-6 md:p-8 lg:p-10', ['bg-white','rounded-lg'])}><p className='text-sm font-semibold'>THE WEEK AHEAD</p><h1 className='text-2xl font-bold'>Make space for focused work.</h1><p className='text-base'>A small view of what matters across the studio.</p><section className='grid grid-cols-2 gap-6 py-6'><Metric label='Active projects' value='4'/><Metric label='Reviews this week' value='2'/></section><h2 className='text-lg font-semibold'>On the desk</h2><ul>{projects.map(project=><li key={project.name} className='py-2 flex justify-between'><span>{project.name}</span><small>{project.stage}</small></li>)}</ul></main>}
