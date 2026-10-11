import Feature from 'ol/Feature'
import GML32 from 'ol/format/GML32'
import WFS from 'ol/format/WFS'
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

// 将地图上的临时点转换成符合 facilities Schema 的事务要素
function createFacilityInsertFeature(mapFeature: Feature<Geometry>, input: FacilityInput): Feature<Point> {
    const mapGeometry = mapFeature.getGeometry()

    if (!(mapGeometry instanceof Point)) {
        throw new Error('只能新增点类型的设施')
    }

    // Draw 产生的是 EPSG:3857，写入前转换成经度、纬度顺序的 CRS:84
    const dataGeometry = mapGeometry.clone()
    dataGeometry.transform('EPSG:3857', TRANSACTION_PROJECTION)

    const insertFeature = new Feature<Point>({
        name: input.name,
        facility_type: input.facilityType,
        description: input.description,
        geom: dataGeometry,
    })

    // GeoServer Schema 中的几何字段名是 geom，而不是默认的 geometry
    insertFeature.setGeometryName('geom')

    return insertFeature
}

// 从 GeoServer XML 异常响应中提取可读错误信息
function readExceptionMessage(xmlText: string): string | null {
    const document = new DOMParser().parseFromString(xmlText, 'application/xml')

    const exceptionNode = document.getElementsByTagNameNS('*', 'ExceptionText')[0]

    return exceptionNode?.textContent?.trim() || null
}

// 将一个设施点作为 WFS Transaction Insert 提交到 GeoServer
export async function insertFacility(mapFeature: Feature<Geometry>, input: FacilityInput): Promise<string> {
    const insertFeature = createFacilityInsertFeature(mapFeature, input)

    const transactionNode = wfsFormat.writeTransaction(
        [insertFeature],
        [],
        [],
        {
            featureNS: FEATURE_NAMESPACE,
            featurePrefix: 'ogc_lab',
            featureType: 'facilities',
            srsName: TRANSACTION_PROJECTION,
            version: '2.0.0',
            nativeElements: [],
        },
    )

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
        throw new Error(
            exceptionMessage ?? `WFS-T Insert 请求失败：${response.status}`,
        )
    }

    const transactionResponse = wfsFormat.readTransactionResponse(responseText)

    if (!transactionResponse || transactionResponse.transactionSummary.totalInserted !== 1) {
        throw new Error('GeoServer 未确认新增设施点')
    }

    return transactionResponse.insertIds[0] ?? '新增设施点'
}