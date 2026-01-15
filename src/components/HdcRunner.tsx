import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Terminal, Save, Trash2, Smartphone, Plus, X, Link, Unlink } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell'; // V2 核心导入
import { generatePreviewCommand, generateUriParam } from '../utils/cmdHelper';

interface Device {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
}

const HdcRunner = () => {
    // --- 状态管理 ---
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [newDeviceIp, setNewDeviceIp] = useState('');
    const [isAddingDevice, setIsAddingDevice] = useState(false);

    // 基础参数
    const [bundleName, setBundleName] = useState('com.extscreen.runtime');
    const [abilityName, setAbilityName] = useState('EntryAbility');

    // 快应用参数
    const [pkgName, setPkgName] = useState('es.com.elsbharmony.tv');
    const [pkgVersion, setPkgVersion] = useState('0.0.2');
    
    // Target URI 选项
    const uriOptions = [
        { label: 'Assets (Default)', value: 'assets:///vue' },
        { label: 'Prod Server', value: 'https://api.extscreen.com/extscreenapi/api/extend_screen/v2/hili/client/tvinfo' },
        { label: 'Test Server', value: 'http://test-api.extscreen.com/extscreenapi/api/extend_screen/v2/hili/client/tvinfo/harmony' },
        { label: 'Local Debug', value: '192.168.0.100' },
        { label: 'Custom', value: '' }
    ];
    const [selectedUriType, setSelectedUriType] = useState(uriOptions[0].value);
    const [customUri, setCustomUri] = useState('');
    
    // 计算最终使用的 URI
    const loadUri = selectedUriType === '' ? customUri : selectedUriType;

    const [isDebug, setIsDebug] = useState(true);
    const [extraParams, setExtraParams] = useState('from=cmd');

    // 日志
    const [logs, setLogs] = useState<string[]>(['Ready.']);

    // 获取完整预览命令
    const fullCommandPreview = generatePreviewCommand(selectedDeviceId || 'No Device Selected', bundleName, abilityName, {
        pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams
    });

    // --- 设备管理逻辑 ---

    const refreshDevices = async () => {
        try {
            setLogs(prev => [...prev, '> Listing devices...']);
            const command = Command.create('hdc', ['list', 'targets']);
            const output = await command.execute();
            
            if (output.code === 0) {
                const lines = output.stdout.split('\n').filter(line => line.trim() !== '' && line.trim() !== '[Empty]');
                const foundDevices: Device[] = lines.map(line => {
                    const id = line.trim();
                    return { id, name: id, status: 'connected' };
                });
                
                // 合并现有设备列表，保留已连接状态
                setDevices(prev => {
                    const newMap = new Map(foundDevices.map(d => [d.id, d]));
                    // 保留之前手动添加但可能未连接的设备记录（如果需要的话），或者直接覆盖
                    // 这里简单处理：直接使用 hdc list targets 的结果作为当前连接设备
                    // 如果需要支持手动输入 IP 连接，逻辑会稍微复杂一点
                    return foundDevices;
                });

                if (foundDevices.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(foundDevices[0].id);
                }
                setLogs(prev => [...prev, `Found ${foundDevices.length} devices.`]);
            } else {
                setLogs(prev => [...prev, `Error listing devices: ${output.stderr}`]);
            }
        } catch (error) {
            setLogs(prev => [...prev, `Error listing devices: ${error}`]);
        }
    };

    const connectDevice = async (ip: string) => {
        if (!ip) return;
        try {
            setLogs(prev => [...prev, `> Connecting to ${ip}...`]);
            const command = Command.create('hdc', ['tmode', 'port', '5555']); // 某些情况可能需要先切模式，视情况而定，通常直接 connect
            // 这里直接 connect
            const connectCmd = Command.create('hdc', ['tconn', ip]);
            const output = await connectCmd.execute();
            setLogs(prev => [...prev, output.stdout]);
            
            if (output.stdout.includes('Connect') || output.stdout.includes('connected')) {
                 refreshDevices();
                 setNewDeviceIp('');
                 setIsAddingDevice(false);
            }
        } catch (error) {
            setLogs(prev => [...prev, `Connection failed: ${error}`]);
        }
    };
    
    // 断开连接通常没有直接的 hdc disconnect 命令对应单个设备，通常是 kill server 或者物理断开
    // 但如果是 TCP 连接，可以尝试不做操作，或者只是从列表中移除（如果 hdc list targets 不再返回它）
    // 这里模拟一个断开操作（实际上 hdc 可能不支持针对单个 IP 的 disconnect，除非重启 server）
    // 修正：hdc tconn 对应的是连接，没有直接的 disconnect 命令。通常只能通过 kill server 重置。
    // 这里我们只做 UI 上的移除，或者执行 hdc kill (慎用)
    // 实际上，用户可能只是想断开 TCP 连接，目前 hdc 工具链对断开支持有限，通常建议重启服务。
    // 我们这里暂时实现为：刷新列表。
    const disconnectDevice = async (id: string) => {
         // 暂时仅刷新
         setLogs(prev => [...prev, `> Refreshing to check if ${id} is still connected...`]);
         refreshDevices();
    };

    useEffect(() => {
        refreshDevices();
    }, []);


    // --- 核心：执行 HDC 命令 ---
    const handleRun = async () => {
        if (!selectedDeviceId) {
            setLogs(prev => [...prev, 'Error: No device selected.']);
            return;
        }

        try {
            setLogs(prev => [...prev, `> Executing on ${selectedDeviceId}...`]);

            // 1. 准备参数
            const uriParam = generateUriParam({
                pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams
            });

            // 2. 调用 hdc
            const command = Command.create('hdc', [
                '-t', selectedDeviceId,
                'shell',
                'aa', 'start',
                '-b', bundleName,
                '-a', abilityName,
                '-U', uriParam
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

                {/* 顶部栏 - 设备管理 */}
                <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-900">
                    <div className="flex items-center space-x-3">
                        <Smartphone className="text-gray-400" size={20} />
                        
                        {/* 设备选择下拉框 */}
                        <div className="relative group">
                            <select 
                                value={selectedDeviceId} 
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-1.5 outline-none min-w-[200px] appearance-none cursor-pointer"
                            >
                                {devices.length === 0 && <option value="">No devices found</option>}
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                ))}
                            </select>
                            {/* 断开按钮 (仅视觉，实际触发刷新) */}
                            {selectedDeviceId && (
                                <button 
                                    onClick={() => disconnectDevice(selectedDeviceId)}
                                    className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400"
                                    title="Disconnect / Refresh"
                                >
                                    <Unlink size={14} />
                                </button>
                            )}
                        </div>

                        {/* 添加设备按钮 */}
                        <div className="relative flex items-center">
                            {isAddingDevice ? (
                                <div className="flex items-center bg-gray-800 rounded border border-gray-700 overflow-hidden">
                                    <input 
                                        type="text" 
                                        placeholder="IP Address" 
                                        className="bg-transparent border-none text-sm px-2 py-1 w-32 outline-none"
                                        value={newDeviceIp}
                                        onChange={e => setNewDeviceIp(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && connectDevice(newDeviceIp)}
                                    />
                                    <button onClick={() => connectDevice(newDeviceIp)} className="p-1 hover:bg-green-900 text-green-400"><Link size={14}/></button>
                                    <button onClick={() => setIsAddingDevice(false)} className="p-1 hover:bg-red-900 text-red-400"><X size={14}/></button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsAddingDevice(true)}
                                    className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white" 
                                    title="Connect New Device"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>

                        <button onClick={refreshDevices} className="p-1.5 hover:bg-gray-800 rounded-full" title="Refresh Devices">
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
                                <div className="flex space-x-2">
                                    <select 
                                        value={selectedUriType} 
                                        onChange={(e) => setSelectedUriType(e.target.value)}
                                        className="bg-black border border-gray-700 rounded p-2 text-sm text-yellow-300 outline-none focus:border-yellow-500 max-w-[150px]"
                                    >
                                        {uriOptions.map(opt => (
                                            <option key={opt.label} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text" 
                                        value={loadUri} 
                                        onChange={e => {
                                            setCustomUri(e.target.value);
                                            setSelectedUriType(''); // 只要用户手动输入，就切换到自定义模式
                                        }}
                                        placeholder="Enter URI..."
                                        className="flex-1 bg-black border border-gray-700 rounded p-2 text-sm text-yellow-300 outline-none focus:border-yellow-500"
                                    />
                                </div>
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
                            disabled={!selectedDeviceId}
                            className={`flex items-center space-x-2 px-6 py-2 rounded text-sm font-medium text-white shadow-lg transition active:scale-95 ${
                                selectedDeviceId 
                                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' 
                                : 'bg-gray-700 cursor-not-allowed opacity-50'
                            }`}>
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