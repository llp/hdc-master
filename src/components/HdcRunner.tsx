import React, { useState, useEffect } from 'react';
import { Play, RefreshCw, Terminal, Save, Trash2, Smartphone, Plus, X, Link, Unlink, Upload, AppWindow, Trash, Settings, Moon, Sun, PlusCircle, MinusCircle, Eraser, ChevronDown, ChevronRight, Edit2, Copy, Monitor } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell'; // V2 核心导入
import { open, confirm as tauriConfirm } from '@tauri-apps/plugin-dialog'; // 引入 tauriConfirm
import { generatePreviewCommand, generateUriParam } from '../utils/cmdHelper';
import wechatQr from '../assets/ic_wechat.jpg'; // 导入微信二维码

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
    abilityName?: string; // 可启动的 Ability Name
}

interface KeyValueParam {
    key: string;
    value: string;
}

const HdcRunner = () => {
    // --- 状态管理 ---
    const [activeTab, setActiveTab] = useState<'runner' | 'apps' | 'device' | 'settings'>('runner');
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
        { label: 'Prod Server', value: 'https://api.extscreen.com/extscreenapi/api/extend_screen/v2/hili/client/tvinfo/harmony' },
        { label: 'Test Server', value: 'http://test-api.extscreen.com/extscreenapi/api/extend_screen/v2/hili/client/tvinfo/harmony' },
        { label: 'Custom', value: '' },
        { label: 'Local Debug', value: '192.168.0.100' }
    ];
    const [selectedUriType, setSelectedUriType] = useState(uriOptions[1].value); // 默认正式环境
    const [customUri, setCustomUri] = useState('');
    
    // 计算最终使用的 URI
    const loadUri = (selectedUriType === '' || selectedUriType === '192.168.0.100') ? customUri : selectedUriType;

    const [isDebug, setIsDebug] = useState(true);
    const [extraParams, setExtraParams] = useState('from=cmd');
    
    // Key-Value Params 管理
    const [kvParams, setKvParams] = useState<KeyValueParam[]>([{ key: 'key', value: 'value' }]);

    // 计算 entry 参数
    // 逻辑：
    // 1. 如果是 Device Tab，entry 固定为 Device
    // 2. 如果是 Runner Tab 且选择了 Local Debug，entry 为 Debug
    // 3. 其他情况 entry 为 Application
    const entryParam = activeTab === 'device' 
        ? 'Device' 
        : (selectedUriType === '192.168.0.100' ? 'Debug' : 'Application');

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
    const [fullCommandPreview, setFullCommandPreview] = useState('');
    const [isEditingCommand, setIsEditingCommand] = useState(false);

    // 当依赖项变化时，自动更新预览命令（如果不在编辑模式）
    useEffect(() => {
        if (!isEditingCommand) {
            const isDeviceMode = activeTab === 'device';
            const cmd = generatePreviewCommand(selectedDeviceId || 'No Device Selected', bundleName, abilityName, {
                pkgName, 
                version: pkgVersion, 
                uri: isDeviceMode ? '' : loadUri, 
                isDebug: isDeviceMode ? false : isDebug, 
                extra: isDeviceMode ? '' : extraParams, 
                entry: entryParam, 
                paramsJson: isDeviceMode ? '' : paramsJson
            });
            setFullCommandPreview(cmd);
        }
    }, [selectedDeviceId, bundleName, abilityName, pkgName, pkgVersion, loadUri, isDebug, extraParams, entryParam, paramsJson, isEditingCommand, activeTab]);

    // 处理 URI 选择变化
    const handleUriTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newValue = e.target.value;
        setSelectedUriType(newValue);
        if (newValue === '192.168.0.100') {
            setCustomUri('192.168.0.100'); // 初始化 Local Debug 的值
        } else if (newValue === '') {
            setCustomUri(''); // 清空 Custom 的值
        }
    };

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

    // 保存成功的命令名称，避免每次都轮询
    const [workingCmd, setWorkingCmd] = useState<string>('');

    const getHdcCommand = (cmdName: string, args: string[]) => {
        if (cmdName === 'hdc-sidecar') {
            return Command.sidecar('hdc', args);
        }
        return Command.create(cmdName, args);
    };

    const refreshDevices = async () => {
        try {
            setLogs(prev => [...prev, '> Listing devices...']);
            
            // 优先使用已知工作的命令
            let commandsToTry = workingCmd ? [workingCmd] : ['hdc-sidecar', 'hdc-deveco', 'hdc', 'hdc-local', 'hdc-brew'];
            
            let output: any = null;
            let successCmd = '';

            for (const cmdName of commandsToTry) {
                try {
                    const command = getHdcCommand(cmdName, ['list', 'targets']);
                    const res = await command.execute();
                    if (res.code === 0) {
                        output = res;
                        successCmd = cmdName;
                        if (!workingCmd) setWorkingCmd(cmdName); // 缓存成功的命令
                        break; 
                    }
                } catch (e) {
                    // console.log(`Failed to execute ${cmdName}:`, e);
                }
            }

            if (output && output.code === 0) {
                const lines = output.stdout.split('\n').filter((line: string) => line.trim() !== '' && line.trim() !== '[Empty]');
                const foundDevices: Device[] = lines.map((line: string) => {
                    const id = line.trim();
                    return { id, name: id, status: 'connected' };
                });
                
                setDevices(foundDevices);

                if (foundDevices.length > 0 && !selectedDeviceId) {
                    setSelectedDeviceId(foundDevices[0].id);
                }
                setLogs(prev => [...prev, `Found ${foundDevices.length} devices (via ${successCmd}).`]);
            } else {
                setLogs(prev => [...prev, `Error listing devices: No hdc command found or execution failed.`]);
                // 如果失败了，清除缓存，下次重试所有
                if (workingCmd) setWorkingCmd('');
            }
        } catch (error) {
            setLogs(prev => [...prev, `Error listing devices: ${error}`]);
        }
    };

    const connectDevice = async (ip: string) => {
        if (!ip) return;
        try {
            setLogs(prev => [...prev, `> Connecting to ${ip}...`]);
            
            let commandsToTry = workingCmd ? [workingCmd] : ['hdc-sidecar', 'hdc-deveco', 'hdc', 'hdc-local', 'hdc-brew'];
            let success = false;

             for (const cmdName of commandsToTry) {
                 try {
                    const tmodeCmd = getHdcCommand(cmdName, ['tmode', 'port', '5555']);
                    await tmodeCmd.execute();
                    
                    const connectCmd = getHdcCommand(cmdName, ['tconn', ip]);
                    const output = await connectCmd.execute();
                    
                    if (output.code === 0) {
                        setLogs(prev => [...prev, output.stdout]);
                        if (output.stdout.includes('Connect') || output.stdout.includes('connected')) {
                            refreshDevices();
                            setNewDeviceIp('');
                            setIsAddingDevice(false);
                        }
                        success = true;
                        if (!workingCmd) setWorkingCmd(cmdName);
                        break;
                    }
                 } catch (e) {}
             }
             
             if (!success) {
                 setLogs(prev => [...prev, `Connection failed: Could not execute hdc command.`]);
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
            let rawOutput = '';
            let commandsToTry = workingCmd ? [workingCmd] : ['hdc-sidecar', 'hdc-deveco', 'hdc', 'hdc-local', 'hdc-brew'];
            
            let output: any = null;
            // let currentCmd = '';

            // 1. 尝试 bm dump
            for (const cmdName of commandsToTry) {
                try {
                    const c = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'bm', 'dump', '-a']);
                    const res = await c.execute();
                    if (res.code === 0) {
                        output = res;
                        // currentCmd = cmdName;
                        if (!workingCmd) setWorkingCmd(cmdName);
                        break;
                    }
                } catch(e) {}
            }

            // 2. 如果 bm dump 失败，尝试 pm list
            if (!output || output.code !== 0 || !output.stdout) {
                 setLogs(prev => [...prev, 'bm dump failed, trying pm list packages...']);
                 for (const cmdName of commandsToTry) {
                    try {
                        const c = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'pm', 'list', 'packages']);
                        const res = await c.execute();
                        if (res.code === 0) {
                            output = res;
                            // currentCmd = cmdName;
                            if (!workingCmd) setWorkingCmd(cmdName);
                            break;
                        }
                    } catch(e) {}
                 }
            }

            if (output && output.code === 0) {
                rawOutput = output.stdout;
                const lines = rawOutput.split('\n');
                const apps: AppInfo[] = [];
                
                lines.forEach((line: string) => {
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
                setLogs(prev => [...prev, `Failed to fetch apps: ${output ? output.stderr : 'Command failed'}`]);
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
        
        if (appList[index].details) {
            const newAppList = [...appList];
            newAppList[index].isExpanded = !newAppList[index].isExpanded;
            setAppList(newAppList);
            return;
        }

        try {
            let cmdName = workingCmd || 'hdc';
            // 尝试 bm dump -n <pkgName>
            const cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'bm', 'dump', '-n', pkgName]);
            const output = await cmd.execute();
            
            let details = '';
            let abilityName = '';

            if (output.code === 0) {
                details = output.stdout;
                // 尝试解析 abilityInfos 中的 name
                // 格式通常是:
                // abilityInfos:
                //   - name: EntryAbility
                //     labelId: ...
                // 或者
                //   name: EntryAbility
                //   labelId: ...
                // 尝试更宽松的正则匹配
                const abilityMatch = details.match(/abilityInfos:[\s\S]*?name:\s*(\w+)/);
                if (abilityMatch && abilityMatch[1]) {
                    abilityName = abilityMatch[1];
                }
            } else {
                // 尝试 dumpsys package <pkgName> (Android 兼容)
                const cmd2 = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'dumpsys', 'package', pkgName]);
                const output2 = await cmd2.execute();
                if (output2.code === 0) {
                    details = output2.stdout;
                } else {
                    details = 'Failed to fetch details.';
                }
            }

            const newAppList = [...appList];
            newAppList[index].details = details;
            newAppList[index].abilityName = abilityName;
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
        const confirmed = await tauriConfirm(`Are you sure you want to uninstall ${pkg}?`, { title: 'Confirm Uninstall', kind: 'warning' });
        
        if (!confirmed) {
            setLogs(prev => [...prev, `> Uninstall cancelled for ${pkg}`]);
            return;
        }

        try {
            setLogs(prev => [...prev, `> Uninstalling ${pkg}...`]);
            let cmdName = workingCmd || 'hdc';
            const cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'bm', 'uninstall', '-n', pkg]);
            const output = await cmd.execute();
            setLogs(prev => [...prev, output.stdout]);
            if (output.stdout.includes('Success') || output.code === 0) {
                fetchAppList();
            }
        } catch (e) {
            setLogs(prev => [...prev, `Uninstall failed: ${e}`]);
        }
    };

    const launchApp = async (pkg: string, ability: string) => {
        if (!ability) {
            setLogs(prev => [...prev, `Error: No ability name found for ${pkg}. Please expand details first.`]);
            return;
        }
        try {
            setLogs(prev => [...prev, `> Launching ${pkg}/${ability}...`]);
            let cmdName = workingCmd || 'hdc';
            const cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'aa', 'start', '-b', pkg, '-a', ability]);
            const output = await cmd.execute();
            setLogs(prev => [...prev, output.stdout]);
        } catch (e) {
            setLogs(prev => [...prev, `Launch failed: ${e}`]);
        }
    };

    // 复制文本到剪贴板
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setLogs(prev => [...prev, 'Copied to clipboard.']);
        }).catch(err => {
            setLogs(prev => [...prev, `Failed to copy: ${err}`]);
        });
    };

    // --- 清除应用数据逻辑 ---
    const clearAppData = async () => {
        if (!selectedDeviceId) {
            setLogs(prev => [...prev, 'Error: No device selected.']);
            return;
        }
        
        const confirmed = await tauriConfirm(`Are you sure you want to clear data for ${bundleName}?`, { title: 'Confirm Clear Data', kind: 'warning' });
        if (!confirmed) return;

        try {
            setLogs(prev => [...prev, `> Clearing data for ${bundleName}...`]);
            let cmdName = workingCmd || 'hdc';
            
            // 优先尝试 bm clean
            let cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'bm', 'clean', '-n', bundleName, '-d']);
            let output = await cmd.execute();
            
            if (output.code !== 0 || output.stdout.toLowerCase().includes('error') || output.stdout.toLowerCase().includes('fail')) {
                 setLogs(prev => [...prev, `bm clean failed (${output.stdout.trim()}), trying pm clear...`]);
                 
                 // 尝试 pm clear
                 cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'shell', 'pm', 'clear', bundleName]);
                 output = await cmd.execute();
                 
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
                
                let cmdName = workingCmd || 'hdc';
                const cmd = getHdcCommand(cmdName, ['-t', selectedDeviceId, 'install', '-r', filePath]);
                
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

            let args: string[] = [];
            
            if (isEditingCommand) {
                // 简单的参数拆分逻辑 (处理引号)
                // 这是一个简化的 parser，可能无法处理所有边缘情况
                const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
                let match;
                const parts = [];
                while ((match = regex.exec(fullCommandPreview)) !== null) {
                    // match[1] 是双引号内容，match[2] 是单引号内容，match[0] 是无引号内容
                    parts.push(match[1] || match[2] || match[0]);
                }
                
                // 移除第一个 'hdc'，因为它是命令本身
                if (parts.length > 0 && parts[0] === 'hdc') {
                    parts.shift();
                }
                args = parts;
            } else {
                const isDeviceMode = activeTab === 'device';
                // 使用自动生成的参数
                const uriParam = generateUriParam({
                    pkgName, 
                    version: pkgVersion, 
                    uri: isDeviceMode ? '' : loadUri,
                    isDebug: isDeviceMode ? false : isDebug,
                    extra: isDeviceMode ? '' : extraParams,
                    entry: entryParam, 
                    paramsJson: isDeviceMode ? '' : paramsJson
                });
                
                args = [
                    '-t', selectedDeviceId,
                    'shell',
                    `aa start -b ${bundleName} -a ${abilityName} -U '${uriParam}'` // 注意这里作为一个整体参数传递给 shell
                ];
            }

            // 2. 调用 hdc
            let cmdName = workingCmd || 'hdc';
            const command = getHdcCommand(cmdName, args);

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
                        onClick={() => setActiveTab('device')}
                        className={`p-3 rounded-xl transition-all ${activeTab === 'device' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : `${textSub} hover:text-gray-400 hover:bg-gray-800/10`}`}
                        title="Device Mode"
                    >
                        <Monitor size={24} />
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
                                                onChange={handleUriTypeChange}
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
                                                    // 如果当前不是 Custom 或 Local Debug，则切换到 Custom
                                                    if (selectedUriType !== '' && selectedUriType !== '192.168.0.100') {
                                                        setSelectedUriType('');
                                                    }
                                                }}
                                                placeholder="Enter URI..."
                                                className={`flex-1 ${inputBg} border ${inputBorder} rounded p-2 text-sm text-yellow-500 outline-none focus:border-yellow-500`}
                                            />
                                        </div>
                                    </div>

                                    {/* Entry 参数显示 (只读) */}
                                    <div className="space-y-1">
                                        <label className={`text-xs ${textSub} ml-1`}>Entry</label>
                                        <input
                                            type="text" value={entryParam} readOnly
                                            className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm text-gray-400 outline-none cursor-not-allowed`}
                                        />
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
                                        <div className="pb-2 flex items-center justify-end">
                                            <label className="flex items-center space-x-2 cursor-pointer select-none">
                                                <input type="checkbox" checked={isDebug} onChange={e => setIsDebug(e.target.checked)} className="accent-blue-600" />
                                                <span className={`text-sm ${textSub}`}>Debug Mode</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Device Mode (New) */}
                    {activeTab === 'device' && (
                        <div className="absolute inset-0 flex flex-col overflow-y-auto p-6 space-y-6">
                            {/* Runtime 配置 (复用) */}
                            <div className={`${bgCard} p-5 rounded-xl border ${borderCol} shadow-sm`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-xs font-bold ${textSub} uppercase tracking-wider`}>Runtime Config</h3>
                                    <button 
                                        onClick={clearAppData}
                                        className={`flex items-center space-x-1 px-2 py-1 ${isDark ? 'bg-red-900/20 hover:bg-red-900/40' : 'bg-red-100 hover:bg-red-200'} text-red-500 rounded text-xs transition`}
                                        title="Clear App Data"
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

                            {/* Device Mode 专属参数 */}
                            <div className={`${bgCard} p-5 rounded-xl border ${borderCol} shadow-sm`}>
                                <h3 className={`text-xs font-bold ${textSub} uppercase tracking-wider mb-4`}>Device Mode Params</h3>
                                <div className="space-y-4">
                                    {/* Entry 参数显示 (只读, 固定为 Device) */}
                                    <div className="space-y-1">
                                        <label className={`text-xs ${textSub} ml-1`}>Entry</label>
                                        <input
                                            type="text" value="Device" readOnly
                                            className={`w-full ${inputBg} border ${inputBorder} rounded p-2 text-sm text-gray-400 outline-none cursor-not-allowed`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: App Manager */}
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
                                                                    {/* 启动按钮 */}
                                                                    {app.abilityName && (
                                                                        <button 
                                                                            onClick={() => launchApp(app.name, app.abilityName!)} 
                                                                            className="p-1.5 bg-green-500/20 hover:bg-green-500/40 text-green-500 rounded mr-2" 
                                                                            title={`Launch ${app.abilityName}`}
                                                                        >
                                                                            <Play size={14}/>
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => uninstallApp(app.name)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded" title="Uninstall">
                                                                        <Trash size={14}/>
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                        {app.isExpanded && (
                                                            <tr>
                                                                <td colSpan={2} className={`p-4 ${isDark ? 'bg-black/20' : 'bg-gray-50'} text-xs font-mono ${textSub} whitespace-pre-wrap break-all relative`}>
                                                                    {app.details || 'Loading details...'}
                                                                    {app.details && (
                                                                        <button 
                                                                            onClick={() => copyToClipboard(app.details!)}
                                                                            className="absolute top-2 right-2 p-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded transition"
                                                                            title="Copy details"
                                                                        >
                                                                            <Copy size={14} />
                                                                        </button>
                                                                    )}
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
                                
                                <div className={`space-y-4 text-left ${isDark ? 'bg-black/30' : 'bg-gray-100'} p-6 rounded-xl border ${borderCol} flex flex-col items-center`}>
                                    <div className="w-full flex justify-center mb-4">
                                        <img src={wechatQr} alt="WeChat QR Code" className="w-32 h-32 rounded-lg shadow-md" />
                                    </div>
                                    <div className="w-full flex justify-between">
                                        <span className={textSub}>Version</span>
                                        <span className={`${textMain} font-mono`}>v1.1.0</span>
                                    </div>
                                </div>

                                <div className={`mt-8 text-xs ${textSub}`}>
                                    Built with Tauri v2 + React + Tailwind
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* 底部操作栏 (仅在 Runner 和 Device Tab 显示) */}
                {(activeTab === 'runner' || activeTab === 'device') && (
                    <div className={`${bgHeader} border-t ${borderCol} p-4 transition-colors duration-300`}>
                        <div className="mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <div className={`text-[10px] ${textSub} uppercase`}>Preview</div>
                                <button 
                                    onClick={() => setIsEditingCommand(!isEditingCommand)}
                                    className={`text-[10px] ${textSub} hover:text-blue-500 flex items-center gap-1`}
                                >
                                    <Edit2 size={10} /> {isEditingCommand ? 'Done' : 'Edit'}
                                </button>
                            </div>
                            {isEditingCommand ? (
                                <textarea
                                    value={fullCommandPreview}
                                    onChange={(e) => setFullCommandPreview(e.target.value)}
                                    className={`block w-full ${isDark ? 'bg-black' : 'bg-gray-100'} p-3 rounded text-xs font-mono ${textSub} break-all border ${borderCol} outline-none focus:border-blue-500 resize-none h-24`}
                                />
                            ) : (
                                <code className={`block ${isDark ? 'bg-black' : 'bg-gray-100'} p-3 rounded text-xs font-mono ${textSub} break-all border ${borderCol}`}>
                                    {fullCommandPreview}
                                </code>
                            )}
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