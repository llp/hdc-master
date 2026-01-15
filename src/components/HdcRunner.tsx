import React, { useState } from 'react';
import { Play, RefreshCw, Terminal, Save, Trash2, Smartphone } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell'; // V2 核心导入
import { generatePreviewCommand, generateUriParam } from '../utils/cmdHelper';

const HdcRunner = () => {
    // --- 状态管理 ---
    const [selectedDevice, setSelectedDevice] = useState('Local Device');

    // 基础参数
    const [bundleName, setBundleName] = useState('com.extscreen.runtime');
    const [abilityName, setAbilityName] = useState('EntryAbility');

    // 快应用参数
    const [pkgName, setPkgName] = useState('es.com.elsbharmony.tv');
    const [pkgVersion, setPkgVersion] = useState('0.0.2');
    const [loadUri, setLoadUri] = useState('assets:///vue');
    const [isDebug, setIsDebug] = useState(true);
    const [extraParams, setExtraParams] = useState('from=cmd');

    // 日志
    const [logs, setLogs] = useState<string[]>(['Ready.']);

    // 获取完整预览命令
    const deviceIdStub = '127.0.0.1:5555'; // 这里暂时硬编码，后续你可以写获取逻辑
    const fullCommandPreview = generatePreviewCommand(deviceIdStub, bundleName, abilityName, {
        pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams
    });

    // --- 核心：执行 HDC 命令 ---
    const handleRun = async () => {
        try {
            setLogs(prev => [...prev, `> Executing...`]);

            // 1. 准备参数
            // 注意：Tauri Shell Plugin 将参数作为数组传递，不要传整个字符串
            const uriParam = generateUriParam({
                pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams
            });

            // 2. 调用 hdc
            // 对应 capabilities/default.json 中的配置
            const command = Command.create('hdc', [
                '-t', deviceIdStub,
                'shell',
                'aa', 'start',
                '-b', bundleName,
                '-a', abilityName,
                '-U', uriParam // 这里不需要加单引号，Tauri 会自动处理参数转义
            ]);

            // 3. 监听输出
            command.on('close', data => {
                setLogs(prev => [...prev, `[Process finished with code ${data.code}]`]);
            });

            command.on('error', error => {
                setLogs(prev => [...prev, `ERR: ${error}`]);
            });

            command.stdout.on('data', line => {
                setLogs(prev => [...prev, line]);
            });

            command.stderr.on('data', line => {
                setLogs(prev => [...prev, `STDERR: ${line}`]);
            });

            // 4. 开始执行
            const child = await command.spawn();
            setLogs(prev => [...prev, `PID: ${child.pid}`]);

        } catch (error) {
            setLogs(prev => [...prev, `Global Error: ${error}`]);
        }
    };

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">

            {/* 侧边栏 */}
            <div className="w-16 flex flex-col items-center py-4 bg-black border-r border-gray-800">
                <div className="p-2 bg-blue-600 rounded-lg"><Terminal size={24} /></div>
            </div>

            {/* 主界面 */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* 顶部栏 */}
                <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-900">
                    <div className="flex items-center space-x-3">
                        <Smartphone className="text-gray-400" size={20} />
                        <select className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-1.5 outline-none">
                            <option>{deviceIdStub}</option>
                        </select>
                        <button className="p-1.5 hover:bg-gray-800 rounded-full" title="List Devices">
                            <RefreshCw size={16} />
                        </button>
                    </div>
                    <div className="text-xs text-gray-500 font-mono font-bold">Tauri v2 Engine</div>
                </div>

                {/* 内容滚动区 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Runtime 配置 */}
                    <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Runtime Config</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">Bundle Name (-b)</label>
                                <input
                                    type="text" value={bundleName} onChange={e => setBundleName(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-blue-300 outline-none focus:border-blue-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">Ability Name (-a)</label>
                                <input
                                    type="text" value={abilityName} onChange={e => setAbilityName(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-blue-300 outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 快应用参数 */}
                    <div className="bg-gray-900/50 p-5 rounded-xl border border-gray-800">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Quick App Params</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-1">
                                    <label className="text-xs text-gray-500 ml-1">Package ID</label>
                                    <input
                                        type="text" value={pkgName} onChange={e => setPkgName(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-green-300 outline-none focus:border-green-500"
                                    />
                                </div>
                                <div className="col-span-1 space-y-1">
                                    <label className="text-xs text-gray-500 ml-1">Version</label>
                                    <input
                                        type="text" value={pkgVersion} onChange={e => setPkgVersion(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-2 text-sm outline-none focus:border-green-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs text-gray-500 ml-1">Target URI</label>
                                <input
                                    type="text" value={loadUri} onChange={e => setLoadUri(e.target.value)}
                                    className="w-full bg-black border border-gray-700 rounded p-2 text-sm text-yellow-300 outline-none focus:border-yellow-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div className="space-y-1">
                                    <label className="text-xs text-gray-500 ml-1">Extra Params</label>
                                    <input
                                        type="text" value={extraParams} onChange={e => setExtraParams(e.target.value)}
                                        className="w-full bg-black border border-gray-700 rounded p-2 text-sm outline-none focus:border-gray-500"
                                    />
                                </div>
                                <div className="pb-2">
                                    <label className="flex items-center space-x-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={isDebug} onChange={e => setIsDebug(e.target.checked)} className="accent-blue-600" />
                                        <span className="text-sm text-gray-300">Debug Mode</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 底部操作栏 */}
                <div className="bg-gray-900 border-t border-gray-800 p-4">
                    <div className="mb-3">
                        <div className="text-[10px] text-gray-500 uppercase mb-1">Preview</div>
                        <code className="block bg-black p-3 rounded text-xs font-mono text-gray-400 break-all border border-gray-800">
                            {fullCommandPreview}
                        </code>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition">
                            <Save size={16} /> <span>Save</span>
                        </button>
                        <button
                            onClick={handleRun}
                            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium text-white shadow-lg shadow-blue-900/20 transition active:scale-95">
                            <Play size={16} fill="currentColor" /> <span>Execute</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* 日志区 */}
            <div className="w-80 bg-black border-l border-gray-800 flex flex-col font-mono text-xs">
                <div className="h-10 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
                    <span className="text-gray-400">Terminal</span>
                    <button onClick={() => setLogs([])}><Trash2 size={14} className="text-gray-500 hover:text-red-400" /></button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-2 text-gray-300">
                    {logs.map((log, i) => (
                        <div key={i} className="break-all border-b border-gray-900 pb-1">{log}</div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default HdcRunner;