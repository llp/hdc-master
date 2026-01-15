import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Terminal, Save, Trash2, Smartphone, Plus, X, Link, Unlink, Package, Upload, AppWindow, Trash, Settings, Info } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell'; // V2 核心导入
import { open } from '@tauri-apps/plugin-dialog';
import { generatePreviewCommand, generateUriParam } from '../utils/cmdHelper';

interface Device {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
}

interface AppInfo {
    name: string;
    isSystem: boolean;
}

const HdcRunner = () => {
    // --- 状态管理 ---
    const [activeTab, setActiveTab] = useState<'runner' | 'apps' | 'settings'>('runner');
    const [devices, setDevices] = useState<Device[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [newDeviceIp, setNewDeviceIp] = useState('');
    const [isAddingDevice, setIsAddingDevice] = useState(false);
    const [appList, setAppList] = useState<AppInfo[]>([]);
    const [isLoadingApps, setIsLoadingApps] = useState(false);

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

    // 计算 entry 参数
    const entryParam = loadUri === '192.168.0.100' ? 'Debug' : 'Application';

    // 日志
    const [logs, setLogs] = useState<string[]>(['Ready.']);

    // 获取完整预览命令
    const fullCommandPreview = generatePreviewCommand(selectedDeviceId || 'No Device Selected', bundleName, abilityName, {
        pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams, entry: entryParam
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
                
                setDevices(foundDevices);

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
            const command = Command.create('hdc', ['tmode', 'port', '5555']); 
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
    
    const disconnectDevice = async (id: string) => {
         setLogs(prev => [...prev, `> Refreshing to check if ${id} is still connected...`]);
         refreshDevices();
    };

    useEffect(() => {
        refreshDevices();
    }, []);

    // --- 应用列表逻辑 ---
    const fetchAppList = async () => {
        if (!selectedDeviceId) {
            setLogs(prev => [...prev, 'Error: No device selected to fetch apps.']);
            return;
        }
        setIsLoadingApps(true);
        setLogs(prev => [...prev, '> Fetching app list...']);
        try {
            // 尝试多种命令组合以兼容不同设备
            // 1. 尝试 bm dump -a (OpenHarmony 标准)
            let rawOutput = '';
            let cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'bm', 'dump', '-a']);
            let output = await cmd.execute();

            if (output.code !== 0 || !output.stdout) {
                 // 2. 尝试 pm list packages (Android 兼容层或旧版)
                 setLogs(prev => [...prev, 'bm dump failed, trying pm list packages...']);
                 cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'pm', 'list', 'packages']);
                 output = await cmd.execute();
            }

            if (output.code === 0) {
                rawOutput = output.stdout;
                const lines = rawOutput.split('\n');
                const apps: AppInfo[] = [];
                
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    
                    // 解析 bm dump -a 的输出 (通常包含 bundle name: xxx)
                    // 或者 pm list packages 的输出 (package:xxx)
                    let name = '';
                    if (trimmed.startsWith('package:')) {
                        name = trimmed.replace('package:', '').trim();
                    } else if (trimmed.includes('.')) {
                        // 简单假设包含点的行可能是包名，如果 bm dump 输出很杂，这里需要更精确的正则
                        // 很多 bm dump 输出直接就是包名列表，或者包含详细信息
                        // 这里做一个简单的过滤：必须包含点，且不包含空格（包名通常无空格）
                        if (!trimmed.includes(' ') && trimmed.length > 5) {
                            name = trimmed;
                        }
                    }

                    if (name) {
                        const isSystem = name.includes('android') || name.includes('huawei') || name.includes('ohos') || name.includes('system') || name.includes('com.example');
                        // 避免重复
                        if (!apps.find(a => a.name === name)) {
                            apps.push({ name, isSystem });
                        }
                    }
                });

                apps.sort((a, b) => (a.isSystem === b.isSystem ? 0 : a.isSystem ? 1 : -1));
                setAppList(apps);
                setLogs(prev => [...prev, `Fetched ${apps.length} apps.`]);
            } else {
                setLogs(prev => [...prev, `Failed to fetch apps: ${output.stderr}`]);
            }
        } catch (error) {
            setLogs(prev => [...prev, `Error fetching apps: ${error}`]);
        } finally {
            setIsLoadingApps(false);
        }
    };

    // 切换到 Apps Tab 时自动刷新
    useEffect(() => {
        if (activeTab === 'apps' && selectedDeviceId) {
            fetchAppList();
        }
    }, [activeTab, selectedDeviceId]);

    const uninstallApp = async (pkg: string) => {
        if (!confirm(`Are you sure you want to uninstall ${pkg}?`)) return;
        try {
            setLogs(prev => [...prev, `> Uninstalling ${pkg}...`]);
            const cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'bm', 'uninstall', '-n', pkg]);
            const output = await cmd.execute();
            setLogs(prev => [...prev, output.stdout]);
            if (output.stdout.includes('Success') || output.code === 0) {
                fetchAppList();
            }
        } catch (e) {
            setLogs(prev => [...prev, `Uninstall failed: ${e}`]);
        }
    };

    const launchApp = async (pkg: string) => {
        try {
            setLogs(prev => [...prev, `> Launching ${pkg}...`]);
            const cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'aa', 'start', '-b', pkg]); 
            const output = await cmd.execute();
            setLogs(prev => [...prev, output.stdout]);
        } catch (e) {
            setLogs(prev => [...prev, `Launch failed: ${e}`]);
        }
    };

    // --- 安装 HAP 逻辑 ---
    const installHap = async () => {
        if (!selectedDeviceId) {
            alert('Please select a device first.');
            return;
        }

        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'HarmonyOS Package',
                    extensions: ['hap']
                }]
            });

            if (selected && typeof selected === 'string') {
                const filePath = selected;
                setLogs(prev => [...prev, `> Installing ${filePath}...`]);
                
                const cmd = Command.create('hdc', ['-t', selectedDeviceId, 'install', '-r', filePath]);
                
                cmd.stdout.on('data', line => setLogs(prev => [...prev, line]));
                cmd.stderr.on('data', line => setLogs(prev => [...prev, `ERR: ${line}`]));
                
                const child = await cmd.spawn();
            }
        } catch (e) {
            setLogs(prev => [...prev, `Install failed: ${e}`]);
        }
    };

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
                pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams, entry: entryParam
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

    const handleSave = () => {
        // 保存当前配置到 localStorage
        const config = {
            bundleName, abilityName, pkgName, pkgVersion, selectedUriType, customUri, isDebug, extraParams
        };
        localStorage.setItem('hdc_runner_config', JSON.stringify(config));
        setLogs(prev => [...prev, 'Configuration saved.']);
    };

    // 加载配置
    useEffect(() => {
        const saved = localStorage.getItem('hdc_runner_config');
        if (saved) {
            try {
                const config = JSON.parse(saved);
                if (config.bundleName) setBundleName(config.bundleName);
                if (config.abilityName) setAbilityName(config.abilityName);
                if (config.pkgName) setPkgName(config.pkgName);
                if (config.pkgVersion) setPkgVersion(config.pkgVersion);
                if (config.selectedUriType) setSelectedUriType(config.selectedUriType);
                if (config.customUri) setCustomUri(config.customUri);
                if (config.isDebug !== undefined) setIsDebug(config.isDebug);
                if (config.extraParams) setExtraParams(config.extraParams);
            } catch (e) {
                console.error('Failed to load config', e);
            }
        }
    }, []);

    return (
        <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">

            {/* 侧边栏 - Tab 切换 */}
            <div className="w-16 flex flex-col items-center py-4 bg-black border-r border-gray-800 justify-between">
                <div className="space-y-6 w-full flex flex-col items-center">
                    <button 
                        onClick={() => setActiveTab('runner')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'runner' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                        title="Runner"
                    >
                        <Terminal size={24} />
                    </button>
                    <button 
                        onClick={() => setActiveTab('apps')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'apps' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                        title="App Manager"
                    >
                        <AppWindow size={24} />
                    </button>
                </div>

                <div className="space-y-4 w-full flex flex-col items-center mb-2">
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900'}`}
                        title="Settings / About"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* 主界面 */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* 顶部栏 - 设备管理 & 安装 HAP (公共) */}
                <div className="h-16 border-b border-gray-800 flex items-center px-6 justify-between bg-gray-900">
                    <div className="flex items-center space-x-3">
                        <Smartphone className="text-gray-400" size={20} />
                        
                        {/* 设备选择 */}
                        <div className="relative group">
                            <select 
                                value={selectedDeviceId} 
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-sm rounded px-3 py-1.5 outline-none min-w-[180px] appearance-none cursor-pointer"
                            >
                                {devices.length === 0 && <option value="">No devices found</option>}
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                ))}
                            </select>
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

                        {/* 添加设备 */}
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

                    {/* 安装 HAP 区域 */}
                    <div className="flex items-center space-x-2 border-l border-gray-800 pl-4 ml-4">
                        <button 
                            onClick={installHap}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
                        >
                            <Upload size={16} /> <span>Install HAP</span>
                        </button>
                    </div>
                </div>

                {/* 内容区域 - 根据 Tab 切换 */}
                <div className="flex-1 overflow-hidden relative">
                    
                    {/* Tab 1: Runner */}
                    {activeTab === 'runner' && (
                        <div className="absolute inset-0 flex flex-col overflow-y-auto p-6 space-y-6">
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
                                        <div className="pb-2 flex items-center justify-between">
                                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                                <input type="checkbox" checked={isDebug} onChange={e => setIsDebug(e.target.checked)} className="accent-blue-600" />
                                                <span className="text-sm text-gray-300">Debug Mode</span>
                                            </label>
                                            <div className="text-xs text-gray-500">Entry: {entryParam}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: App Manager */}
                    {activeTab === 'apps' && (
                        <div className="absolute inset-0 flex flex-col p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold text-gray-300 flex items-center gap-2">
                                    <AppWindow size={20} /> Installed Applications
                                </h2>
                                <button onClick={fetchAppList} className="p-2 bg-gray-800 hover:bg-gray-700 rounded text-sm flex items-center gap-2">
                                    <RefreshCw size={14} /> Refresh List
                                </button>
                            </div>
                            
                            <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
                                {isLoadingApps ? (
                                    <div className="flex-1 flex items-center justify-center text-gray-500">
                                        <div className="animate-spin mr-2"><RefreshCw size={20}/></div> Loading apps...
                                    </div>
                                ) : appList.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-gray-500">
                                        No apps found or device not connected.
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className="bg-gray-900 text-gray-500 font-medium border-b border-gray-800 sticky top-0">
                                                <tr>
                                                    <th className="p-3 pl-4">Package Name</th>
                                                    <th className="p-3">Type</th>
                                                    <th className="p-3 text-right pr-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {appList.map((app, i) => (
                                                    <tr key={i} className="hover:bg-gray-800/50 group">
                                                        <td className="p-3 pl-4 font-mono text-gray-300">{app.name}</td>
                                                        <td className="p-3">
                                                            <span className={`text-xs px-2 py-0.5 rounded ${app.isSystem ? 'bg-gray-800 text-gray-500' : 'bg-blue-900/30 text-blue-400'}`}>
                                                                {app.isSystem ? 'System' : 'User'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right pr-4">
                                                            {!app.isSystem && (
                                                                <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button onClick={() => launchApp(app.name)} className="p-1.5 bg-green-900/30 hover:bg-green-900 text-green-400 rounded" title="Launch">
                                                                        <Play size={14}/>
                                                                    </button>
                                                                    <button onClick={() => uninstallApp(app.name)} className="p-1.5 bg-red-900/30 hover:bg-red-900 text-red-400 rounded" title="Uninstall">
                                                                        <Trash size={14}/>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className="p-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-500 text-center">
                                    Total: {appList.length} apps
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Settings / About */}
                    {activeTab === 'settings' && (
                        <div className="absolute inset-0 flex flex-col p-6 items-center justify-center text-center">
                            <div className="bg-gray-900/50 p-8 rounded-2xl border border-gray-800 max-w-md w-full">
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
                                    <Terminal size={32} className="text-white" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">HDC Runner</h2>
                                <p className="text-gray-400 mb-8">A GUI tool for HarmonyOS Device Connector</p>
                                
                                <div className="space-y-4 text-left bg-black/30 p-6 rounded-xl border border-gray-800/50">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Developer</span>
                                        <span className="text-gray-200 font-medium">Liu Lipeng</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Contact</span>
                                        <span className="text-gray-200 font-medium">liulipeng@example.com</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Version</span>
                                        <span className="text-gray-200 font-mono">v1.0.0</span>
                                    </div>
                                </div>

                                <div className="mt-8 text-xs text-gray-600">
                                    Built with Tauri v2 + React + Tailwind
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* 底部操作栏 (仅在 Runner Tab 显示) */}
                {activeTab === 'runner' && (
                    <div className="bg-gray-900 border-t border-gray-800 p-4">
                        <div className="mb-3">
                            <div className="text-[10px] text-gray-500 uppercase mb-1">Preview</div>
                            <code className="block bg-black p-3 rounded text-xs font-mono text-gray-400 break-all border border-gray-800">
                                {fullCommandPreview}
                            </code>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button 
                                onClick={handleSave}
                                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm text-gray-300 transition"
                            >
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
                )}

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