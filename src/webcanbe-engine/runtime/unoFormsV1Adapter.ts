/**
 * Fixed operator-owned translation of the zero-argument
 * @julr/unocss-preset-forms@1.0.0 preset. This source is injected into the
 * isolated CSS worker; neither the uploaded package nor an operator-installed
 * copy of that package is imported or executed.
 */
export const UNO_FORMS_V1_ADAPTER_SOURCE = String.raw`
function fixedUnoFormsV1Preset(){
 const selectSvg=color=>"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='"+encodeURIComponent(color)+"' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e";
 const checkboxSvg="data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e";
 const radioSvg="data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e";
 const indeterminateSvg="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 16 16'%3e%3cpath stroke='white' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 8h8'/%3e%3c/svg%3e";
 const spacing=value=>({2:"0.5rem",3:"0.75rem",4:"1rem",10:"2.5rem"})[value];
 const inputs=["[type='text']","input:where(:not([type]))","[type='email']","[type='url']","[type='password']","[type='number']","[type='date']","[type='datetime-local']","[type='month']","[type='search']","[type='tel']","[type='time']","[type='week']","[multiple]","textarea","select"];
 const rules=[
  {base:inputs,class:[".form-input",".form-textarea",".form-select",".form-multiselect"],styles:theme=>({"appearance":"none","background-color":"#fff","border-color":theme.colors.gray["500"],"border-width":"1px","border-radius":theme.borderRadius.none,"padding-top":spacing(2),"padding-right":spacing(3),"padding-bottom":spacing(2),"padding-left":spacing(3),"font-size":theme.fontSize.base[0],"line-height":theme.lineHeight.normal+"rem","--un-shadow":"0 0 #0000"})},
  {base:inputs.map(value=>value+":focus"),styles:theme=>({"outline":"2px solid transparent","outline-offset":"2px","--un-ring-inset":"var(--un-empty,/*!*/ /*!*/)","--un-ring-offset-width":"0px","--un-ring-offset-color":"#fff","--un-ring-color":theme.colors.blue["600"],"--un-ring-offset-shadow":"var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color)","--un-ring-shadow":"var(--un-ring-inset) 0 0 0 calc(1px + var(--un-ring-offset-width)) var(--un-ring-color)","box-shadow":"var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow)","border-color":theme.colors.blue["600"]})},
  {base:["input::placeholder","textarea::placeholder"],class:[".form-input::placeholder",".form-textarea::placeholder"],styles:theme=>({"color":theme.colors.gray["500"],"opacity":"1"})},
  {base:["::-webkit-datetime-edit-fields-wrapper"],class:[".form-input::-webkit-datetime-edit-fields-wrapper"],styles:{"padding":"0"}},
  {base:["::-webkit-date-and-time-value"],class:[".form-input::-webkit-date-and-time-value"],styles:{"min-height":"1.5em"}},
  {base:["::-webkit-date-and-time-value"],class:[".form-input::-webkit-date-and-time-value"],styles:{"text-align":"inherit"}},
  {base:["::-webkit-datetime-edit"],class:[".form-input::-webkit-datetime-edit"],styles:{"display":"inline-flex"}},
  {base:["::-webkit-datetime-edit","::-webkit-datetime-edit-year-field","::-webkit-datetime-edit-month-field","::-webkit-datetime-edit-day-field","::-webkit-datetime-edit-hour-field","::-webkit-datetime-edit-minute-field","::-webkit-datetime-edit-second-field","::-webkit-datetime-edit-millisecond-field","::-webkit-datetime-edit-meridiem-field"],class:[".form-input::-webkit-datetime-edit",".form-input::-webkit-datetime-edit-year-field",".form-input::-webkit-datetime-edit-month-field",".form-input::-webkit-datetime-edit-day-field",".form-input::-webkit-datetime-edit-hour-field",".form-input::-webkit-datetime-edit-minute-field",".form-input::-webkit-datetime-edit-second-field",".form-input::-webkit-datetime-edit-millisecond-field",".form-input::-webkit-datetime-edit-meridiem-field"],styles:{"padding-top":0,"padding-bottom":0}},
  {base:["select"],class:[".form-select"],styles:theme=>({"background-image":'url("'+selectSvg(theme.colors.gray["500"])+'")',"background-position":"right "+spacing(2)+" center","background-repeat":"no-repeat","background-size":"1.5em 1.5em","padding-right":spacing(10),"print-color-adjust":"exact"})},
  {base:["[multiple]"],class:null,styles:{"background-image":"initial","background-position":"initial","background-repeat":"unset","background-size":"initial","padding-right":spacing(3),"print-color-adjust":"unset"}},
  {base:["[type='checkbox']","[type='radio']"],class:[".form-checkbox",".form-radio"],styles:theme=>({"appearance":"none","padding":"0","print-color-adjust":"exact","display":"inline-block","vertical-align":"middle","background-origin":"border-box","user-select":"none","flex-shrink":"0","height":spacing(4),"width":spacing(4),"color":theme.colors.blue["600"],"background-color":"#fff","border-color":theme.colors.gray["500"],"border-width":"1px","--un-shadow":"0 0 #0000"})},
  {base:["[type='checkbox']"],class:[".form-checkbox"],styles:theme=>({"border-radius":theme.borderRadius.none})},
  {base:["[type='radio']"],class:[".form-radio"],styles:{"border-radius":"100%"}},
  {base:["[type='checkbox']:focus","[type='radio']:focus"],class:[".form-checkbox:focus",".form-radio:focus"],styles:theme=>({"outline":"2px solid transparent","outline-offset":"2px","--un-ring-inset":"var(--un-empty,/*!*/ /*!*/)","--un-ring-offset-width":"2px","--un-ring-offset-color":"#fff","--un-ring-color":theme.colors.blue["600"],"--un-ring-offset-shadow":"var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color)","--un-ring-shadow":"var(--un-ring-inset) 0 0 0 calc(2px + var(--un-ring-offset-width)) var(--un-ring-color)","box-shadow":"var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow)"})},
  {base:["[type='checkbox']:checked","[type='radio']:checked"],class:[".form-checkbox:checked",".form-radio:checked"],styles:{"border-color":"transparent","background-color":"currentColor","background-size":"100% 100%","background-position":"center","background-repeat":"no-repeat"}},
  {base:["[type='checkbox']:checked"],class:[".form-checkbox:checked"],styles:{"background-image":'url("'+checkboxSvg+'")'}},
  {base:["[type='radio']:checked"],class:[".form-radio:checked"],styles:{"background-image":'url("'+radioSvg+'")'}},
  {base:["[type='checkbox']:checked:hover","[type='checkbox']:checked:focus","[type='radio']:checked:hover","[type='radio']:checked:focus"],class:[".form-checkbox:checked:hover",".form-checkbox:checked:focus",".form-radio:checked:hover",".form-radio:checked:focus"],styles:{"border-color":"transparent","background-color":"currentColor"}},
  {base:["[type='checkbox']:indeterminate"],class:[".form-checkbox:indeterminate"],styles:{"background-image":'url("'+indeterminateSvg+'")',"border-color":"transparent","background-color":"currentColor","background-size":"100% 100%","background-position":"center","background-repeat":"no-repeat"}},
  {base:["[type='checkbox']:indeterminate:hover","[type='checkbox']:indeterminate:focus"],class:[".form-checkbox:indeterminate:hover",".form-checkbox:indeterminate:focus"],styles:{"border-color":"transparent","background-color":"currentColor"}},
  {base:["[type='file']"],class:null,styles:{"background":"unset","border-color":"inherit","border-width":"0","border-radius":"0","padding":"0","font-size":"unset","line-height":"inherit"}},
  {base:["[type='file']:focus"],class:null,styles:{"outline":"1px solid ButtonText , 1px auto -webkit-focus-ring-color"}}
 ];
 const merge=(styles,theme)=>Object.assign({},...styles.map(style=>typeof style==="function"?style(theme):style));
 const classStyles=Object.create(null);
 for(const rule of rules)for(const className of rule.class||[])(classStyles[className]||(classStyles[className]=[])).push(rule.styles);
 const unoRules=Object.entries(classStyles).map(([className,styles])=>{
  const selector=className.slice(1),dynamic=styles.some(style=>typeof style==="function");
  return dynamic?[new RegExp("^"+selector+"$"),(_,context)=>merge(styles,context.theme)]:[selector,merge(styles,{})];
 });
 return{name:"webcanbe-fixed-unocss-preset-forms-1.0.0",rules:unoRules,preflights:[{getCSS:({theme})=>rules.map(rule=>{
  const declarations=Object.entries(typeof rule.styles==="function"?rule.styles(theme):rule.styles).map(([key,value])=>key+": "+value+";").join("\n");
  return rule.base.join(", ")+" { "+declarations+" }";
 }).join("\n")}]};
}
`
