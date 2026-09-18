import fs from 'node:fs'
import path from 'node:path'
import { isWithin, safeArchivePath, type ProjectRecord } from './projectRegistry'

/** Project-relative identity, shared by filesystem and durable hosted authority. */
export function sourceDirectory(project: Pick<ProjectRecord, 'root' | 'sourceRoot'>) {
  const directory = path.relative(project.root, project.sourceRoot).split(path.sep).join('/')
  if (!safeArchivePath(directory) || directory.split('/').some(p => p.startsWith('.'))) throw Error('Invalid canonical source directory.')
  return directory
}
export function assertSourceDirectory(project: Pick<ProjectRecord, 'root' | 'sourceRoot'>) {
  const directory = sourceDirectory(project)
  if (fs.realpathSync(project.root) !== project.root) throw Error('Source root identity changed.')
  let current = project.root
  for (const part of directory.split('/')) {
    current = path.join(current, part)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink() || !stat.isDirectory() || fs.realpathSync(current) !== current || !isWithin(project.root, current)) throw Error('Source root identity changed.')
  }
  return directory
}
export const editableModule = /\.(?:tsx?|jsx?|mts|cts|mjs|cjs|css|json)$/
export function sourceMember(file: string, directory = 'src', scope?: 2) {
  return safeArchivePath(file) === file && file.startsWith(directory + '/') && (scope === 2 ? editableModule : /\.(?:tsx?|jsx?|css|json)$/).test(file)
}

/** Whether a finite TS include prefix intersects the canonical source tree. */
export function includesSource(configFile: string, include: string, directory: string) {
  const prefix = path.posix.join(path.posix.dirname(configFile), include).split('*')[0].replace(/\/$/, '')
  return prefix === '.' || prefix === directory || prefix.startsWith(directory + '/') || directory.startsWith(prefix + '/')
}
