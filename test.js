var assert = require('assert');
var child_process = require('child_process');

function buffersToString(buffers) {
    return Buffer.concat(buffers).toString('utf8')
}

function runWithExit(cmd, ...args) {
    return run(['exit'], cmd, ...args)
}

function runWithClose(cmd, ...args) {
    return run(['close'], cmd, ...args)
}

function runWithBoth(cmd, ...args) {
    return run(['exit', 'close'], cmd, ...args)
}

function run(listenTo, cmd, ...args) {
    return new Promise((resolve, reject) => {
        const spawned = child_process.spawn(cmd, args);

        const stdOut = [];
        const stdErr = [];

        const stderrOnData = (data) => {
            stdErr.push(data);
        };
        const stdoutOnData = (data) => {
            stdOut.push(data);
        };
        const onClose = (exitCode) => {
            const res = { stdOut: buffersToString(stdOut), stdErr: buffersToString(stdErr), exitCode };
            removeListeners();
            resolve(res);
        }
        const onExit = (exitCode) => {
            setTimeout(() => {
                const res = { stdOut: buffersToString(stdOut), stdErr: buffersToString(stdErr), exitCode };
                removeListeners();
                resolve(res);
            }, 50);
        };
        const onError = (err) => {
            removeListeners();
            reject(err);
        };
        const removeListeners = () => {
            spawned.stderr.off("data", stderrOnData);
            spawned.stdout.off("data", stdoutOnData);
            if (listenTo.includes('close')) {
                spawned.off("close", onClose);
            }
            if (listenTo.includes('exit')) {
                spawned.off("exit", onExit);
            }
            spawned.off("error", onError);
        }
        spawned.stderr.on("data", stderrOnData);
        spawned.stdout.on("data", stdoutOnData);
        if (listenTo.includes('close')) {
            spawned.on("close", onClose);
        }
        if (listenTo.includes('exit')) {
            spawned.on("exit", onExit);
        }
        spawned.on("error", onError);
    });
}

const tries = 20;
// The more there are parallel processes, the more likely
// it is to loss data when listening on `exit` event. 
const processes = 100;
for (let i = 0; i < tries; i++) {
    describe('Capturing `stdout`', function () {
        it('returning on `exit` +50ms', async function () {
            const s = []
            for (let i = 0; i < processes; i++) {
                s.push(Math.round(Math.random() * 200000));
            }
            const res = await Promise.all(s.map(async n => {
                return await runWithExit('python', 'test.py', n);
            }));
            assert.deepEqual(res.map(r => r.exitCode), s.map(r => 0));
            assert.deepEqual(res.map(r => r.stdOut.length), s.map(n => 'Hello world\n'.length * n), 'Ooops...');
        });
        it('returning on `exit` +50ms OR on `close`', async function () {
            const s = []
            for (let i = 0; i < processes; i++) {
                s.push(Math.round(Math.random() * 200000));
            }
            const res = await Promise.all(s.map(async n => {
                return await runWithBoth('python', 'test.py', n);
            }));
            assert.deepEqual(res.map(r => r.exitCode), s.map(r => 0));
            assert.deepEqual(res.map(r => r.stdOut.length), s.map(n => 'Hello world\n'.length * n), 'Ooops...');
        });
        it('returning on `close`', async function () {
            const s = []
            for (let i = 0; i < processes; i++) {
                s.push(Math.round(Math.random() * 200000));
            }
            const res = await Promise.all(s.map(async n => {
                return await runWithClose('python', 'test.py', n);
            }));
            assert.deepEqual(res.map(r => r.exitCode), s.map(r => 0));
            assert.deepEqual(res.map(r => r.stdOut.length), s.map(n => 'Hello world\n'.length * n), 'Ooops...');
        });
    });
}
