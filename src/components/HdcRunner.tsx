import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Terminal, Save, Trash2, Smartphone, Plus, X, Link, Unlink, Package, Upload, AppWindow, Trash, Settings, Info, Moon, Sun, PlusCircle, MinusCircle, Eraser, ChevronDown, ChevronRight } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell'; // V2 核心导入
import { open, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'; // 引入 tauriConfirm
import { generatePreviewCommand, generateUriParam } from '../utils/cmdHelper';

interface Device {
    id: string;
    name: string;
    status: 'connected' | 'disconnected';
}

interface AppInfo {
    name: string; // 包名
    isSystem: boolean;
    details?: string; // 详细信息
    isExpanded?: boolean; // 是否展开
}

interface KeyValueParam {
    key: string;
    value: string;
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
    
    // 主题管理 (默认 light)
    const [theme, setTheme] = useState<'dark' | 'light'>('light');

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
    
    // Key-Value Params 管理
    const [kvParams, setKvParams] = useState<KeyValueParam[]>([{ key: 'key', value: 'value' }]);

    // 计算 entry 参数
    const entryParam = loadUri === '192.168.0.100' ? 'Debug' : 'Application';

    // 日志
    const [logs, setLogs] = useState<string[]>(['Ready.']);

    // 动态生成 paramsJson
    const paramsJson = JSON.stringify(
        kvParams.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>)
    );

    // 获取完整预览命令
    const fullCommandPreview = generatePreviewCommand(selectedDeviceId || 'No Device Selected', bundleName, abilityName, {
        pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams, entry: entryParam, paramsJson
    });

    // --- 主题切换逻辑 ---
    useEffect(() => {
        // 初始化主题，优先读取本地存储，否则默认 light
        const savedTheme = localStorage.getItem('hdc_runner_theme') as 'dark' | 'light' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            setTheme('light'); // 默认白色
        }
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('hdc_runner_theme', newTheme);
    };

    // --- KV Params 逻辑 ---
    const addKvParam = () => {
        setKvParams([...kvParams, { key: '', value: '' }]);
    };

    const removeKvParam = (index: number) => {
        const newParams = [...kvParams];
        newParams.splice(index, 1);
        setKvParams(newParams);
    };

    const updateKvParam = (index: number, field: 'key' | 'value', value: string) => {
        const newParams = [...kvParams];
        newParams[index][field] = value;
        setKvParams(newParams);
    };

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
                    
                    let name = '';
                    if (trimmed.startsWith('package:')) {
                        name = trimmed.replace('package:', '').trim();
                    } else if (trimmed.includes('.')) {
                        if (!trimmed.includes(' ') && trimmed.length > 5) {
                            name = trimmed;
                        }
                    }

                    if (name) {
                        const isSystem = name.includes('android') || name.includes('huawei') || name.includes('ohos') || name.includes('system') || name.includes('com.example');
                        
                        // 过滤掉系统应用
                        if (!isSystem && !apps.find(a => a.name === name)) {
                            apps.push({ name, isSystem: false });
                        }
                    }
                });

                // 排序
                apps.sort((a, b) => a.name.localeCompare(b.name));
                setAppList(apps);
                setLogs(prev => [...prev, `Fetched ${apps.length} user apps.`]);
            } else {
                setLogs(prev => [...prev, `Failed to fetch apps: ${output.stderr}`]);
            }
        } catch (error) {
            setLogs(prev => [...prev, `Error fetching apps: ${error}`]);
        } finally {
            setIsLoadingApps(false);
        }
    };

    // 获取应用详情
    const fetchAppDetails = async (pkgName: string, index: number) => {
        if (!selectedDeviceId) return;
        
        // 如果已经展开且有详情，则只切换展开状态
        if (appList[index].details) {
            const newAppList = [...appList];
            newAppList[index].isExpanded = !newAppList[index].isExpanded;
            setAppList(newAppList);
            return;
        }

        try {
            // 尝试 bm dump -n <pkgName>
            const cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'bm', 'dump', '-n', pkgName]);
            const output = await cmd.execute();
            
            let details = '';
            if (output.code === 0) {
                details = output.stdout;
            } else {
                // 尝试 dumpsys package <pkgName> (Android 兼容)
                const cmd2 = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'dumpsys', 'package', pkgName]);
                const output2 = await cmd2.execute();
                if (output2.code === 0) {
                    details = output2.stdout;
                } else {
                    details = 'Failed to fetch details.';
                }
            }

            const newAppList = [...appList];
            newAppList[index].details = details;
            newAppList[index].isExpanded = true;
            setAppList(newAppList);

        } catch (error) {
            console.error(error);
        }
    };

    // 切换到 Apps Tab 时自动刷新
    useEffect(() => {
        if (activeTab === 'apps' && selectedDeviceId) {
            fetchAppList();
        }
    }, [activeTab, selectedDeviceId]);

    const uninstallApp = async (pkg: string) => {
        // 使用 Tauri 的 confirm 对话框，它是异步的，会等待用户点击
        const confirmed = await tauriConfirm(`Are you sure you want to uninstall ${pkg}?`, { title: 'Confirm Uninstall', kind: 'warning' });
        
        if (!confirmed) {
            setLogs(prev => [...prev, `> Uninstall cancelled for ${pkg}`]);
            return;
        }

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

    // --- 清除应用数据逻辑 ---
    const clearAppData = async () => {
        if (!selectedDeviceId) {
            setLogs(prev => [...prev, 'Error: No device selected.']);
            return;
        }
        
        // 确认对话框
        const confirmed = await tauriConfirm(`Are you sure you want to clear data for ${bundleName}?`, { title: 'Confirm Clear Data', kind: 'warning' });
        if (!confirmed) return;

        try {
            setLogs(prev => [...prev, `> Clearing data for ${bundleName}...`]);
            // 尝试 bm clean -n <bundleName> -d (OpenHarmony)
            // 或者 pm clear <bundleName> (Android/HarmonyOS 兼容)
            
            // 优先尝试 bm clean
            let cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'bm', 'clean', '-n', bundleName, '-d']);
            let output = await cmd.execute();
            
            // 检查 bm clean 是否成功
            // 注意：bm clean 有时即使成功也可能没有输出，或者输出包含 Success
            // 如果失败，通常会包含 error 或 fail
            // 如果 bm clean 失败，尝试 pm clear
            if (output.code !== 0 || output.stdout.toLowerCase().includes('error') || output.stdout.toLowerCase().includes('fail')) {
                 setLogs(prev => [...prev, `bm clean failed (${output.stdout.trim()}), trying pm clear...`]);
                 
                 // 尝试 pm clear
                 cmd = Command.create('hdc', ['-t', selectedDeviceId, 'shell', 'pm', 'clear', bundleName]);
                 output = await cmd.execute();
                 
                 // 检查 pm clear 结果
                 if (output.code !== 0 || output.stdout.toLowerCase().includes('inaccessible') || output.stdout.toLowerCase().includes('not found')) {
                     setLogs(prev => [...prev, `pm clear failed: ${output.stdout}`]);
                     setLogs(prev => [...prev, `Error: Neither 'bm clean' nor 'pm clear' worked. Please check device compatibility.`]);
                     return;
                 }
            }
            
            setLogs(prev => [...prev, output.stdout]);
            if (output.code === 0 && !output.stdout.toLowerCase().includes('error')) {
                setLogs(prev => [...prev, 'Data cleared successfully.']);
            }

        } catch (e) {
            setLogs(prev => [...prev, `Clear data failed: ${e}`]);
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
                
                await cmd.spawn();
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
                pkgName, version: pkgVersion, uri: loadUri, isDebug, extra: extraParams, entry: entryParam, paramsJson
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
            bundleName, abilityName, pkgName, pkgVersion, selectedUriType, customUri, isDebug, extraParams, kvParams
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
                if (config.kvParams) setKvParams(config.kvParams);
            } catch (e) {
                console.error('Failed to load config', e);
            }
        }
    }, []);

    // --- 样式定义 (基于 Theme) ---
    const isDark = theme === 'dark';
    const bgMain = isDark ? 'bg-gray-950' : 'bg-gray-50';
    const bgSidebar = isDark ? 'bg-black' : 'bg-white';
    const bgCard = isDark ? 'bg-gray-900/50' : 'bg-white';
    const bgHeader = isDark ? 'bg-gray-900' : 'bg-white';
    const bgTerminal = isDark ? 'bg-black' : 'bg-gray-900'; // 终端始终保持深色比较好看，或者也可以切
    const textMain = isDark ? 'text-gray-100' : 'text-gray-800';
    const textSub = isDark ? 'text-gray-500' : 'text-gray-500';
    const borderCol = isDark ? 'border-gray-800' : 'border-gray-200';
    const inputBg = isDark ? 'bg-black' : 'bg-gray-100';
    const inputBorder = isDark ? 'border-gray-700' : 'border-gray-300';

    return (
        <div className={`flex h-screen ${bgMain} ${textMain} font-sans transition-colors duration-300`}>

            {/* 侧边栏 - Tab 切换 */}
            <div className={`w-16 flex flex-col items-center py-4 ${bgSidebar} border-r ${borderCol} justify-between transition-colors duration-300`}>
                <div className="space-y-6 w-full flex flex-col items-center">
                    <button 
                        onClick={() => setActiveTab('runner')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'runner' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : `${textSub} hover:text-gray-400 hover:bg-gray-800/10`}`}
                        title="Runner"
                    >
                        <Terminal size={24} />
                    </button>
                    <button 
                        onClick={() => setActiveTab('apps')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'apps' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : `${textSub} hover:text-gray-400 hover:bg-gray-800/10`}`}
                        title="App Manager"
                    >
                        <AppWindow size={24} />
                    </button>
                </div>

                <div className="space-y-4 w-full flex flex-col items-center mb-2">
                    <button 
                        onClick={toggleTheme}
                        className={`p-3 rounded-xl transition-all ${textSub} hover:text-gray-400 hover:bg-gray-800/10`}
                        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
                    >
                        {isDark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-gray-800 text-white' : `${textSub} hover:text-gray-400 hover:bg-gray-800/10`}`}
                        title="Settings / About"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            {/* 主界面 */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* 顶部栏 - 设备管理 & 安装 HAP (公共) */}
                <div className={`h-16 border-b ${borderCol} flex items-center px-6 justify-between ${bgHeader} transition-colors duration-300`}>
                    <div className="flex items-center space-x-3 flex-1 min-w-0"> {/* flex-1 min-w-0 防止挤压 */}
                        <Smartphone className={`${textSub} flex-shrink-0`} size={20} />
                        
                        {/* 设备选择 */}
                        <div className="relative group flex-1 max-w-md"> {/* 限制最大宽度 */}
                            <select 
                                value={selectedDeviceId} 
                                onChange={(e) => setSelectedDeviceId(e.target.value)}
                                className={`w-full ${isDark ? 'bg-gray-800' : 'bg-gray-100'} border ${isDark ? 'border-gray-700' : 'border-gray-300'} text-sm rounded px-3 py-1.5 pr-8 outline-none appearance-none cursor-pointer truncate`}
                            >
                                {devices.length === 0 && <option value="">No devices found</option>}
                                {devices.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.status})</option>
                                ))}
                            </select>
                            {/* 下拉箭头 */}
                            <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                            {selectedDeviceId && (
                                <button 
                                    onClick={() => disconnectDevice(selectedDeviceId)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400"
                                    title="Disconnect / Refresh"
                                >
                                    <Unlink size={14} />
                                </button>
                            )}
                        </div>

                        {/* 添加设备 */}
                        <div className="relative flex items-center flex-shrink-0">
                            {isAddingDevice ? (
                                <div className={`flex items-center ${isDark ? 'bg-gray-800' : 'bg-gray-100'} rounded border ${isDark ? 'border-gray-700' : 'border-gray-300'} overflow-hidden`}>
                                    <input 
                                        type="text" 
                                        placeholder="IP Address" 
                                        className="bg-transparent border-none text-sm px-2 py-1 w-32 outline-none"
                                        value={newDeviceIp}
                                        onChange={e => setNewDeviceIp(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && connectDevice(newDeviceIp)}
                                    />
                                    <button onClick={() => connectDevice(newDeviceIp)} className="p-1 hover:bg-green-900/20 text-green-500"><Link size={14}/></button>
                                    <button onClick={() => setIsAddingDevice(false)} className="p-1 hover:bg-red-900/20 text-red-500"><X size={14}/></button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setIsAddingDevice(true)}
                                    className={`p-1.5 hover:bg-gray-800/10 rounded-full ${textSub} hover:text-blue-500`} 
                                    title="Connect New Device"
                                >
                                    <Plus size={16} />
                                </button>
                            )}
                        </div>

                        <button onClick={refreshDevices} className={`p-1.5 hover:bg-gray-800/10 rounded-full ${textSub} flex-shrink-0`} title="Refresh Devices">
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {/* 安装 HAP 区域 */}
                    <div className={`flex items-center space-x-2 border-l ${borderCol} pl-4 ml-4 flex-shrink-0`}>
                        <button 
                            onClick={installHap}
                            className={`flex items-center space-x-2 px-3 py-1.5 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded text-sm ${textSub} transition`}
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
                            <div className={`${bgCard} p-5 rounded-xl border ${borderCol} shadow-sm`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Runtime Config</h3>
                                    {/* 清除数据按钮 */}
                                    <button 
                                        onClick={clearAppData}
                                        className={`flex items-center space-x-1 px-2 py-1 ${isDark ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-100 hover:bg-red-200'} text-red-500 rounded text-xs transition`}
                                        title="Clear App Data (pm clear / bm clean)"
                                    >
                                        <Eraser size={12} /> <span>Clear Data</span>
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className={`text-xs ${textSub} ml-1`}>Bundle Name (-b)</label>
                                        <input
                                            type="text" value={bundleName} onChange={e => setBundleName(e.target.value)}
                                            className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm text-blue-500 outline-none focus:border-blue-500`}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className={`text-xs ${textSub} ml-1`}>Ability Name (-a)</label>
                                        <input
                                            type="text" value={abilityName} onChange={e => setAbilityName(e.target.value)}
                                            className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm text-blue-500 outline-none focus:border-blue-500`}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 快应用参数 */}
                            <div className={`${bgCard} p-5 rounded-xl border ${borderCol} shadow-sm`}>
                                <h3 className={`text-xs font-bold ${textSub} uppercase tracking-wider mb-4`}>Quick App Params</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-2 space-y-1">
                                            <label className={`text-xs ${textSub} ml-1`}>Package ID</label>
                                            <input
                                                type="text" value={pkgName} onChange={e => setPkgName(e.target.value)}
                                                className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm text-green-500 outline-none focus:border-green-500`}
                                            />
                                        </div>
                                        <div className="col-span-1 space-y-1">
                                            <label className={`text-xs ${textSub} ml-1`}>Version</label>
                                            <input
                                                type="text" value={pkgVersion} onChange={e => setPkgVersion(e.target.value)}
                                                className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm outline-none focus:border-green-500`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className={`text-xs ${textSub} ml-1`}>Target URI</label>
                                        <div className="flex space-x-2">
                                            <select 
                                                value={selectedUriType} 
                                                onChange={(e) => setSelectedUriType(e.target.value)}
                                                className={`${inputBg} border ${inputBorder} rounded p-2 text-sm text-yellow-500 outline-none focus:border-yellow-500 max-w-[150px]`}
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
                                                className={`flex-1 ${inputBg} border ${inputBorder} rounded p-2 text-sm text-yellow-500 outline-none focus:border-yellow-500`}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className={`text-xs ${textSub} ml-1`}>Params (Key-Value)</label>
                                            <button onClick={addKvParam} className={`text-xs ${textSub} hover:text-blue-500 flex items-center gap-1`}>
                                                <PlusCircle size={12} /> Add Param
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {kvParams.map((param, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Key"
                                                        value={param.key}
                                                        onChange={(e) => updateKvParam(index, 'key', e.target.value)}
                                                        className={`flex-1 ${inputBg} border ${inputBorder} rounded p-2 text-sm outline-none focus:border-purple-500`}
                                                    />
                                                    <span className={textSub}>:</span>
                                                    <input
                                                        type="text"
                                                        placeholder="Value"
                                                        value={param.value}
                                                        onChange={(e) => updateKvParam(index, 'value', e.target.value)}
                                                        className={`flex-1 ${inputBg} border ${inputBorder} rounded p-2 text-sm outline-none focus:border-purple-500`}
                                                    />
                                                    <button 
                                                        onClick={() => removeKvParam(index)}
                                                        className={`p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded`}
                                                        title="Remove"
                                                    >
                                                        <MinusCircle size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {kvParams.length === 0 && (
                                                <div className={`text-xs ${textSub} text-center py-2 border border-dashed ${borderCol} rounded`}>
                                                    No parameters. Click "Add Param" to add one.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 items-end">
                                        <div className="space-y-1">
                                            <label className={`text-xs ${textSub} ml-1`}>Extra Params</label>
                                            <input
                                                type="text" value={extraParams} onChange={e => setExtraParams(e.target.value)}
                                                className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm outline-none focus:border-gray-500`}
                                            />
                                        </div>
                                        <div className="pb-2 flex items-center justify-between">
                                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                                <input type="checkbox" checked={isDebug} onChange={e => setIsDebug(e.target.checked)} className="accent-blue-600" />
                                                <span className={`text-sm ${textSub}`}>Debug Mode</span>
                                            </label>
                                            <div className={`text-xs ${textSub}`}>Entry: {entryParam}</div>
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
                                <h2 className={`text-lg font-bold ${textMain} flex items-center gap-2`}>
                                    <AppWindow size={20} /> Installed Applications
                                </h2>
                                <button onClick={fetchAppList} className={`p-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded text-sm flex items-center gap-2 transition`}>
                                    <RefreshCw size={14} /> Refresh List
                                </button>
                            </div>
                            
                            <div className={`flex-1 ${bgCard} border ${borderCol} rounded-xl overflow-hidden flex flex-col shadow-sm`}>
                                {isLoadingApps ? (
                                    <div className={`flex-1 flex items-center justify-center ${textSub}`}>
                                        <div className="animate-spin mr-2"><RefreshCw size={20}/></div> Loading apps...
                                    </div>
                                ) : appList.length === 0 ? (
                                    <div className={`flex-1 flex items-center justify-center ${textSub}`}>
                                        No apps found or device not connected.
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto">
                                        <table className="w-full text-left text-sm">
                                            <thead className={`${isDark ? 'bg-gray-900' : 'bg-gray-100'} ${textSub} font-medium border-b ${borderCol} sticky top-0`}>
                                                <tr>
                                                    <th className="p-3 pl-4">Package Name</th>
                                                    <th className="p-3 text-right pr-4">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className={`divide-y ${borderCol}`}>
                                                {appList.map((app, i) => (
                                                    <React.Fragment key={i}>
                                                        <tr 
                                                            className={`hover:bg-gray-500/10 group cursor-pointer ${app.isExpanded ? 'bg-gray-500/5' : ''}`}
                                                            onClick={() => fetchAppDetails(app.name, i)}
                                                        >
                                                            <td className="p-3 pl-4 font-mono text-sm flex items-center gap-2">
                                                                <span className={textSub}>
                                                                    {app.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                </span>
                                                                <div className={textMain}>{app.name}</div>
                                                            </td>
                                                            <td className="p-3 text-right pr-4">
                                                                <div className="flex justify-end space-x-2" onClick={e => e.stopPropagation()}>
                                                                    <button onClick={() => uninstallApp(app.name)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded" title="Uninstall">
                                                                        <Trash size={14}/>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {app.isExpanded && (
                                                            <tr>
                                                                <td colSpan={2} className={`p-4 ${isDark ? 'bg-black/20' : 'bg-gray-50'} text-xs font-mono ${textSub} whitespace-pre-wrap break-all`}>
                                                                    {app.details || 'Loading details...'}
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <div className={`p-2 ${isDark ? 'bg-gray-900' : 'bg-gray-100'} border-t ${borderCol} text-xs ${textSub} text-center`}>
                                    Total: {appList.length} user apps
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Settings / About */}
                    {activeTab === 'settings' && (
                        <div className="absolute inset-0 flex flex-col p-6 items-center justify-center text-center">
                            <div className={`${bgCard} p-8 rounded-2xl border ${borderCol} max-w-md w-full shadow-lg`}>
                                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/30">
                                    <Terminal size={32} className="text-white" />
                                </div>
                                <h2 className={`text-2xl font-bold ${textMain} mb-2`}>HDC Runner</h2>
                                <p className={`${textSub} mb-8`}>A GUI tool for HarmonyOS Device Connector</p>
                                
                                <div className={`space-y-4 text-left ${isDark ? 'bg-black/30' : 'bg-gray-100'} p-6 rounded-xl border ${borderCol}`}>
                                    <div className="flex justify-between">
                                        <span className={textSub}>Developer</span>
                                        <span className={`${textMain} font-medium`}>Liu Lipeng</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={textSub}>Contact</span>
                                        <span className={`${textMain} font-medium`}>WeChat：pengliliu</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className={textSub}>Version</span>
                                        <span className={`${textMain} font-mono`}>v1.0.0</span>
                                    </div>
                                </div>

                                <div className={`mt-8 text-xs ${textSub}`}>
                                    Built with Tauri v2 + React + Tailwind
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* 底部操作栏 (仅在 Runner Tab 显示) */}
                {activeTab === 'runner' && (
                    <div className={`${bgHeader} border-t ${borderCol} p-4 transition-colors duration-300`}>
                        <div className="mb-3">
                            <div className={`text-[10px] ${textSub} uppercase mb-1`}>Preview</div>
                            <code className={`block ${isDark ? 'bg-black' : 'bg-gray-100'} p-3 rounded text-xs font-mono ${textSub} break-all border ${borderCol}`}>
                                {fullCommandPreview}
                            </code>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button 
                                onClick={handleSave}
                                className={`flex items-center space-x-2 px-4 py-2 ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded text-sm ${textSub} transition`}
                            >
                                <Save size={16} /> <span>Save</span>
                            </button>
                            <button
                                onClick={handleRun}
                                disabled={!selectedDeviceId}
                                className={`flex items-center space-x-2 px-6 py-2 rounded text-sm font-medium text-white shadow-lg transition active:scale-95 ${
                                    selectedDeviceId 
                                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20' 
                                    : 'bg-gray-500 cursor-not-allowed opacity-50'
                                }`}>
                                <Play size={16} fill="currentColor" /> <span>Execute</span>
                            </button>
                        </div>
                    </div>
                )}

            </div>

            {/* 日志区 */}
            <div className={`w-80 ${bgTerminal} border-l ${borderCol} flex flex-col font-mono text-xs transition-colors duration-300`}>
                <div className={`h-10 border-b ${borderCol} flex items-center justify-between px-4 ${bgHeader}`}>
                    <span className={textSub}>Terminal</span>
                    <button onClick={() => setLogs([])}><Trash2 size={14} className={`${textSub} hover:text-red-400`} /></button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-2 text-gray-300">
                    {logs.map((log, i) => (
                        <div key={i} className={`break-all border-b ${isDark ? 'border-gray-900' : 'border-gray-800'} pb-1`}>{log}</div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default HdcRunner;