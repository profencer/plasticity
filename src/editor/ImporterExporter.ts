import * as fs from 'fs';
import c3d from '../../build/Release/c3d.node';
import ContourManager from './curves/ContourManager';
import { Empties } from './Empties';
import { Images } from "./Images";
import { GeometryDatabase } from "./GeometryDatabase";
import { PlaneDatabase } from './PlaneDatabase';
import { ConstructionPlane } from './snaps/ConstructionPlaneSnap';
import { Scene } from './Scene';
import * as THREE from 'three';

export class ImporterExporter {
    constructor(
        private readonly db: GeometryDatabase,
        private readonly empties: Empties,
        private readonly scene: Scene,
        private readonly images: Images,
        private readonly contours: ContourManager
    ) { }

    async open(filePaths: string[], cplane?: ConstructionPlane) {
        const { db, contours, empties, images, scene } = this;
        for (const filePath of filePaths) {
            if (/\.c3d$/.test(filePath)) {
                const data = await fs.promises.readFile(filePath);
                await db.deserialize(data);
                await contours.rebuild();
            } else if (/\.png$/.test(filePath)) {
                if (cplane === undefined) cplane = PlaneDatabase.XY;
                const data = await fs.promises.readFile(filePath);
                await images.add(filePath, data);
                const empty = empties.addImage(filePath);
                const transform = { position: cplane.p.clone(), quaternion: cplane.orientation.clone(), scale: new THREE.Vector3(1, 1, 1) };
                scene.setTransform(empty, transform);
            } else {
                const { result, model } = await c3d.Conversion.ImportFromFile_async(filePath);
                if (result !== c3d.ConvResType.Success) {
                    console.error(filePath, c3d.ConvResType[result]);
                    continue;
                }
                await db.load(model, false);
            }
        }
    }

    async export(model: c3d.Model, filePath: string) {
        if (/\.c3d$/.test(filePath!)) {
            const data = await c3d.Writer.WriteItems_async(model);
            await fs.promises.writeFile(filePath, data.memory);
        } else {
            await c3d.Conversion.ExportIntoFile_async(model, filePath!);
        }
    }
}