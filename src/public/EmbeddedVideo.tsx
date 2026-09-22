/** An optional, editor-supplied embed URL. No player is rendered without actual media. */
export function EmbeddedVideo({src,title='A walkthrough of your workspace'}:{src?:string;title?:string}) {
  const url = src && /^https:\/\/(www\.youtube-nocookie\.com\/embed\/|player\.vimeo\.com\/video\/)/.test(src) ? src : undefined
  return <figure className="wcb-doc-video">{url?<iframe src={url} title={title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:<div><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12 5v15M12 5C8 3 5 3 2 4v15c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1Z"/></svg><h2>{title}</h2><p>Follow the written guide to browse a project, edit your copy, and export the source.</p><a href="/docs/getting-started">Read the getting started guide</a></div>}</figure>
}
