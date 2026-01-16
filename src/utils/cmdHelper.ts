// 定义参数接口
export interface HdcParams {
    pkgName: string;
    version: string;
    uri: string;
    isDebug: boolean;
    extra: string;
    entry?: string;
    paramsJson?: string; // 新增 params 参数 (JSON 字符串)
}

/**
 * 生成 -U 参数内部的 URI
 */
export const generateUriParam = (params: HdcParams): string => {
    const queryParts: string[] = [];

    // 1. entry
    if (params.entry) queryParts.push(`entry=${params.entry}`);
    
    // 2. uri (需要编码)
    if (params.uri) queryParts.push(`uri=${encodeURIComponent(params.uri)}`);
    
    // 3. params (JSON 对象，需要编码)
    if (params.paramsJson && params.paramsJson !== '{}') {
        queryParts.push(`params=${encodeURIComponent(params.paramsJson)}`);
    }

    // 4. debug
    if (params.isDebug) queryParts.push('debug=true');

    // 5. extra (from=cmd 等)
    if (params.extra) queryParts.push(params.extra);

    // 修改：如果 version 为空，不添加尾部斜杠，避免出现 //
    let fullUri = `esapp://${params.pkgName}`;
    if (params.version) {
        fullUri += `/${params.version}`;
    }

    if (queryParts.length > 0) {
        fullUri += `?${queryParts.join('&')}`;
    }

    return fullUri;
};

/**
 * 生成用于 UI 显示的完整命令字符串
 */
export const generatePreviewCommand = (
    deviceId: string,
    bundle: string,
    ability: string,
    params: HdcParams
): string => {
    const uriVal = generateUriParam(params);
    // 修改：将 shell 后面的整个命令用双引号包裹，以确保参数被正确解析
    // 注意：内部的单引号包裹 URI 保持不变
    return `hdc -t ${deviceId} shell "aa start -b ${bundle} -a ${ability} -U '${uriVal}'"`;
};