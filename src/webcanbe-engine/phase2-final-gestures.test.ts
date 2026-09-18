import {expect,it} from 'vitest'
import {pixelGestureOrigin,pixelGestureValue,siblingGestureDirection} from './visual-editor/semanticGesture'
import type {StyleOrigin} from './core/types'
const origin=(value:string,kind:StyleOrigin['kind']='css'):StyleOrigin=>({property:'width',kind,value,editable:true,file:'src/style.css',range:{start:10,end:20}})
it('converts scaled gesture delta from authored CSS pixels without using computed boxes',()=>{
 const start=pixelGestureOrigin([origin('120px')],'width')!;expect(pixelGestureValue(start,15,.5)).toBe('150px');expect(pixelGestureValue(start,-.25,.5)).toBe('119.5px')
 const inline=pixelGestureOrigin([origin('120','inline')],'width')!;expect(pixelGestureValue(inline,10,1)).toBe('130');expect(pixelGestureValue(pixelGestureOrigin([origin("'120px'",'inline')],'width')!,10,1)).toBe('130px')
})
it('refuses ambiguous, dynamic, non-pixel, missing-source and excessive geometry',()=>{
 for(const value of ['auto','100%','calc(1px + 2vw)','var(--size)','1e6px','-1px','4097px','1rem','120px; color:red'])expect(pixelGestureOrigin([origin(value)],'width')).toBeUndefined()
 expect(pixelGestureOrigin([origin('120px'),origin('120px')],'width')).toBeUndefined();expect(pixelGestureOrigin([{...origin('120px'),editable:false}],'width')).toBeUndefined();expect(pixelGestureOrigin([{...origin('120px'),file:undefined}],'width')).toBeUndefined()
 const start=pixelGestureOrigin([origin('120px')],'width')!;for(const[delta,scale]of [[0,1],[Infinity,1],[1,0],[1,2],[5000,1],[-121,1]])expect(pixelGestureValue(start,delta,scale)).toBeUndefined()
})
it('source order gestures require an intentional bounded directional movement',()=>{
 expect(siblingGestureDirection(12,0,.5)).toBe('next');expect(siblingGestureDirection(0,-24,1)).toBe('previous');expect(siblingGestureDirection(2,1,1)).toBeUndefined();expect(siblingGestureDirection(Infinity,1,1)).toBeUndefined();expect(siblingGestureDirection(30,0,0)).toBeUndefined()
})
