import Feature from 'ol/Feature'
import GML32 from 'ol/format/GML32'
import WFS from 'ol/format/WFS'
import type { WriteTransactionOptions } from 'ol/format/WFS'
import type Geometry from 'ol/geom/Geometry'
import Point from 'ol/geom/Point'

const WFS_TRANSACTION_URL = '/wfs-transaction'
const FEATURE_NAMESPACE = 'http://localhost/ogc_lab'
const TRANSACTION_PROJECTION = 'CRS:84'

export interface FacilityInput {
    name: string
    facilityType: string
    description: string
}

const wfsFormat = new WFS({
    version: '2.0.0',
    gmlFormat: new GML32(),
})

const transactionOptions: WriteTransactionOptions = {
    featureNS: FEATURE_NAMESPACE,
    featurePrefix: 'ogc_lab',
    featureType: 'facilities',
    srsName: TRANSACTION_PROJECTION,
    version: '2.0.0',
    nativeElements: [],
}

// 将地图设施点转换成符合 facilities Schema 的事务要素
function createFacilityTransactionFeature(
    mapFeature: Feature<Geometry>,
    input: FacilityInput,
    featureId?: string,
): Feature<Point> {
    const mapGeometry = mapFeature.getGeometry()

    if (!(mapGeometry instanceof Point)) {
        throw new Error('只能编辑点类型的设施')
    }

    // Draw 产生的是 EPSG:3857，写入前转换成经度、纬度顺序的 CRS:84
    const dataGeometry = mapGeometry.clone()
    dataGeometry.transform('EPSG:3857', TRANSACTION_PROJECTION)

    const transactionFeature = new Feature<Point>({
        name: input.name,
        facility_type: input.facilityType,
        description: input.description,
        geom: dataGeometry,
    })

    transactionFeature.setGeometryName('geom')

    if (featureId) {
        transactionFeature.setId(featureId)
    }

    return transactionFeature
}

// 从 GeoServer XML 异常响应中提取可读错误信息
function readExceptionMessage(xmlText: string): string | null {
    const document = new DOMParser().parseFromString(xmlText, 'application/xml')

    const exceptionNode = document.getElementsByTagNameNS('*', 'ExceptionText')[0]

    return exceptionNode?.textContent?.trim() || null
}

// 向 GeoServer 提交事务 XML，并解析标准事务响应
async function submitTransaction(transactionNode: Node) {
    const transactionXml = new XMLSerializer().serializeToString(transactionNode)

    const response = await fetch(WFS_TRANSACTION_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml',
        },
        body: transactionXml,
    })

    const responseText = await response.text()
    const exceptionMessage = readExceptionMessage(responseText)

    if (!response.ok || exceptionMessage) {
        throw new Error(exceptionMessage ?? `WFS-T 请求失败：${response.status}`)
    }

    const transactionResponse = wfsFormat.readTransactionResponse(responseText)

    if (!transactionResponse) {
        throw new Error('无法解析 GeoServer 事务响应')
    }

    return transactionResponse
}

// 将一个设施点作为 WFS Transaction Insert 提交到 GeoServer
export async function insertFacility(mapFeature: Feature<Geometry>, input: FacilityInput): Promise<string> {
    const insertFeature = createFacilityTransactionFeature(mapFeature, input)

    const transactionNode = wfsFormat.writeTransaction(
        [insertFeature],
        [],
        [],
        transactionOptions,
    )

    const transactionResponse = await submitTransaction(transactionNode)

    if (transactionResponse.transactionSummary.totalInserted !== 1) {
        throw new Error('GeoServer 未确认新增设施点')
    }

    return transactionResponse.insertIds[0] ?? '新增设施点'
}

// 将设施点的最新几何和属性作为 WFS Transaction Update 提交
export async function updateFacility(
    mapFeature: Feature<Geometry>,
    input: FacilityInput,
    featureId: string,
): Promise<void> {
    const updateFeature = createFacilityTransactionFeature(
        mapFeature,
        input,
        featureId,
    )

    const transactionNode = wfsFormat.writeTransaction(
        [],
        [updateFeature],
        [],
        transactionOptions,
    )

    const transactionResponse = await submitTransaction(transactionNode)

    if (transactionResponse.transactionSummary.totalUpdated !== 1) {
        throw new Error('GeoServer 未确认修改设施点')
    }
}

// 根据服务端 Feature ID 删除一个设施点
export async function deleteFacility(featureId: string): Promise<void> {
    const deleteFeature = new Feature<Geometry>()
    deleteFeature.setId(featureId)

    const transactionNode = wfsFormat.writeTransaction(
        [],
        [],
        [deleteFeature],
        transactionOptions,
    )

    const transactionResponse = await submitTransaction(transactionNode)

    if (transactionResponse.transactionSummary.totalDeleted !== 1) {
        throw new Error('GeoServer 未确认删除设施点')
    }
}