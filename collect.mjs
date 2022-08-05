import { readdir, rename, mkdir } from 'fs/promises'
import { join } from 'path'

import { spawn } from 'child_process'

const dirs = {}
const mk = (prefix, roomid) => {
  if (!dirs[prefix]) {
    dirs[prefix] = {}
  }
  if (!dirs[prefix][roomid]) {
    dirs[prefix][roomid] = mkdir(join(prefix, roomid)).catch(mkdirCatch)
  }
  return dirs[prefix][roomid]
}

const mkdirCatch = e => {
  if (e.code !== 'EEXIST') {
    throw e
  }
}

const z = async prefix => {
  const zip = spawn('7zz', ['a', '-tzip', '-r', join('zip', `${prefix}.zip`), prefix])
  zip.stderr.pipe(process.stderr)
  const zipCode = await new Promise(resolve => zip.on('exit', resolve))
  console.log(`${prefix} zip ${zipCode}`)
}

const collect = async prefix => {
  const rooms = await readdir('danmaku')
  const roomFiles = await Promise.all(rooms.filter(roomid => !Number.isNaN(Number(roomid))).map(async roomid => [roomid, await readdir(join('danmaku', roomid))]))
  const pairs = roomFiles.flatMap(([roomid, files]) => files.map(file => [roomid, file]))
  const targets = pairs.filter(([_, file]) => file.startsWith(`${prefix}-`))
  console.log(`${prefix} ${targets.length}`)
  if (!targets.length) {
    return { p: Promise.resolve() }
  }
  await mkdir(prefix).catch(mkdirCatch)
  await Promise.all(targets.map(([roomid, file]) => mk(prefix, roomid).then(() => rename(join('danmaku', roomid, file), join(prefix, roomid, file)))))
  console.log(`${prefix} move`)

  const zp = z(prefix)

  const gitAdd = spawn('git', ['add', 'danmaku'])
  gitAdd.stderr.pipe(process.stderr)
  const gitAddCode = await new Promise(resolve => gitAdd.on('exit', resolve))
  console.log(`${prefix} git add ${gitAddCode}`)

  const gitCommit = spawn('git', ['commit', '-m', `'del ${prefix}'`])
  gitCommit.stdout.on('data', () => { })
  gitCommit.stderr.pipe(process.stderr)
  const gitCommitCode = await new Promise(resolve => gitCommit.on('exit', resolve))
  console.log(`${prefix} git commit ${gitCommitCode}`)

  return { p: zp }
}

  ;

(async () => {
  await mkdir('zip').catch(mkdirCatch)

  const years = [2022]
  const months = [1, 2, 3, 4, 5, 6, 7]
  const prefixes = years.flatMap(year => months.map(month => `${year}-${month}`))
  const zps = []
  for (const prefix of prefixes) {
    zps.push((await collect(prefix)).p)
  }

  await Promise.all(zps)
  console.log('All done')
})()
