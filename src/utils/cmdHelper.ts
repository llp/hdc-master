// 定义参数接口
export interface HdcParams {
    pkgName: string;
    version: string;
    uri: string;
    isDebug: boolean;
    extra: string;
    entry?: string; // 新增 entry 参数
}

/**
 * 生成 -U 参数内部的 URI
 */
export const generateUriParam = (params: HdcParams): string => {
    const queryParts: string[] = [];

    if (params.extra) queryParts.push(params.extra);
    // 核心：对 uri 进行编码，防止 & 等符号截断命令
    if (params.uri) queryParts.push(`uri=${encodeURIComponent(params.uri)}`);
    if (params.isDebug) queryParts.push('debug=true');
    if (params.entry) queryParts.push(`entry=${params.entry}`); // 处理 entry

    let fullUri = `esapp://${params.pkgName}/${params.version}`;
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
    // 单引号包裹 URI，防止 shell 解析错误
    return `hdc -t ${deviceId} shell aa start -b ${bundle} -a ${ability} -U '${uriVal}'`;
};