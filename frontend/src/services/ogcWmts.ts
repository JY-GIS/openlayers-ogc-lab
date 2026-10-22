import TileLayer from 'ol/layer/Tile'
import WMTSCapabilities from 'ol/format/WMTSCapabilities'
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS'

export const WMTS_CAPABILITIES_URL = '/geoserver/gwc/service/wmts?SERVICE=WMTS&REQUEST=GetCapabilities&VERSION=1.0.0'

// 读取 GeoWebCache 能力文档并创建设施点 WMTS 图层
export async function createFacilitiesWmtsLayer(): Promise<TileLayer<WMTS>> {
    const response = await fetch(WMTS_CAPABILITIES_URL)

    if (!response.ok) {
        throw new Error(`WMTS GetCapabilities 请求失败：${response.status}`)
    }

    const capabilitiesText = await response.text()
    const capabilities = new WMTSCapabilities().read(capabilitiesText)

    const sourceOptions = optionsFromCapabilities(capabilities, {
        layer: 'ogc_lab:facilities',
        matrixSet: 'EPSG:900913',
        style: 'point',
        format: 'image/png',
        requestEncoding: 'KVP', // 不使用'REST'可以确保图层是png,防止JPEG导致出现白色不透明背景
    })

    if (!sourceOptions) {
        throw new Error('WMTS 能力文档中未找到 facilities 图层')
    }

    return new TileLayer({
        visible: false,
        source: new WMTS(sourceOptions),
    })
}