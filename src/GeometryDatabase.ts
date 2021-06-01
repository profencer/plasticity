import * as THREE from 'three';
import c3d from '../build/Release/c3d.node';
import { EditorSignals } from './Editor';
import { Clone, GeometryMemento } from './History';
import MaterialDatabase from './MaterialDatabase';
import { assertUnreachable, WeakValueMap } from './util/Util';
import * as visual from './VisualModel';

const precision_distance: [number, number][] = [[0.1, 50], [0.001, 5], [0.0001, 0.5]];

export interface TemporaryObject {
    cancel(): void;
    commit(): Promise<visual.SpaceItem>;
}

let counter = 0;

export class GeometryDatabase {
    readonly drawModel = new Set<visual.SpaceItem>();
    readonly scene = new THREE.Scene();
    private readonly geometryModel = new Map<number, c3d.Item>();
    private readonly name2topologyItem = new WeakValueMap<c3d.SimpleName, visual.TopologyItem>();

    constructor(
        private readonly materials: MaterialDatabase,
        private readonly signals: EditorSignals) { }

    async addItem(object: c3d.Item): Promise<visual.SpaceItem> {
        const current = counter++;
        this.geometryModel.set(current, object);

        const mesh = await this.meshes(object, precision_distance);
        mesh.userData.simpleName = current;

        this.scene.add(mesh);
        this.drawModel.add(mesh);

        this.signals.objectAdded.dispatch(mesh); // FIXME dispatch object and mesh, since snapmanager is just looking up the object immediately afterward
        this.signals.sceneGraphChanged.dispatch();
        return mesh;
    }

    async addTemporaryItem(object: c3d.Item): Promise<TemporaryObject> {
        const mesh = await this.meshes(object, [[0.005, 1]]);
        this.scene.add(mesh);
        return {
            cancel: () => {
                mesh.dispose();
                this.scene.remove(mesh);
            },
            commit: () => {
                this.scene.remove(mesh);
                return this.addItem(object);
            }
        }
    }

    removeItem(object: visual.Item) {
        this.scene.remove(object);
        this.drawModel.delete(object);
        this.geometryModel.delete(object.userData.simpleName);

        this.signals.objectRemoved.dispatch(object);
        this.signals.sceneGraphChanged.dispatch();
    }

    private lookupItem(object: visual.Item): c3d.Item {
        if (!this.geometryModel.has(object.userData.simpleName)) {
            throw new Error("invalid precondition");
        }
        const item = this.geometryModel.get(object.userData.simpleName);
        return item!;
    }

    // FIXME rethink error messages and consider using Family rather than isA for curve3d?
    lookup(object: visual.Solid): c3d.Solid;
    lookup(object: visual.SpaceInstance<any>): c3d.SpaceInstance;
    lookup(object: visual.Item): c3d.Item;
    lookup(object: visual.Item): c3d.Item {
        const item = this.lookupItem(object);
        return item;
    }

    lookupTopologyItem(object: visual.Face): c3d.Face;
    lookupTopologyItem(object: visual.Edge): c3d.Edge;
    lookupTopologyItem(object: visual.Edge | visual.Face): c3d.TopologyItem {
        const parent = object.parentItem;
        const parentModel = this.lookupItem(parent);
        if (!(parentModel instanceof c3d.Solid)) throw new Error("Invalid precondition");
        const solid = parentModel;

        if (object instanceof visual.Edge) {
            const result = solid.FindEdgeByName(object.userData.name);
            if (!result) throw new Error("cannot find edge");
            return result;
        } else if (object instanceof visual.Face) {
            const result = solid.FindFaceByName(object.userData.name);
            if (!result) throw new Error("cannot find face");
            return result;
        }
        assertUnreachable(object);
    }

    lookupByName(name: c3d.Name): visual.TopologyItem {
        const result = this.name2topologyItem.get(name.Hash());
        if (!result) throw new Error("item not found");
        return result;
    }

    private async meshes(obj: c3d.Item, precision_distance: [number, number][]): Promise<visual.Item> {
        let builder;
        switch (obj.IsA()) {
            case c3d.SpaceType.SpaceInstance:
                builder = new visual.SpaceInstanceBuilder();
                break;
            default:
                builder = new visual.SolidBuilder();
        }

        for (const [precision, distance] of precision_distance) {
            await this.object2mesh(builder, obj, precision, distance);
        }

        const result = builder.build();
        return result;
    }

    private async object2mesh(builder: any, obj: c3d.Item, sag: number, distance?: number): Promise<void> {
        const stepData = new c3d.StepData(c3d.StepType.SpaceStep, sag);
        const note = new c3d.FormNote(true, true, true, false, false);
        const item = await obj.CreateMesh_async(stepData, note);
        const mesh = item.Cast<c3d.Mesh>(c3d.SpaceType.Mesh);
        switch (obj.IsA()) {
            case c3d.SpaceType.SpaceInstance: {
                const instance = builder as visual.SpaceInstanceBuilder<visual.Curve3D>;
                const curve3D = new visual.Curve3DBuilder();
                const edges = mesh.GetEdges();
                let material = this.materials.line(obj as c3d.SpaceInstance);
                for (const edge of edges) {
                    const line = visual.CurveSegment.build(edge, material);
                    curve3D.addCurveSegment(line);
                }
                instance.addLOD(curve3D.build(), distance);
                break;
            }
            // case c3d.SpaceType.Point3D: {
            //     const apexes = mesh.GetApexes();
            //     const geometry = new THREE.BufferGeometry();
            //     geometry.setAttribute('position', new THREE.Float32BufferAttribute(apexes, 3));
            //     const points = new THREE.Points(geometry, this.materials.point(obj));
            //     return points;
            // }
            default: {
                const solid = builder as visual.SolidBuilder;
                const edges = new visual.CurveEdgeGroupBuilder();
                const lineMaterial = this.materials.line();
                const polygons = mesh.GetEdges(true);
                for (const edge of polygons) {
                    const line = visual.CurveEdge.build(edge, lineMaterial, this.materials.lineDashed());
                    this.name2topologyItem.set(edge.name.Hash(), line);
                    edges.addEdge(line);
                }

                const faces = new visual.FaceGroupBuilder();
                const grids = mesh.GetBuffers();
                for (const grid of grids) {
                    const material = this.materials.mesh(grid, mesh.IsClosed());
                    const face = visual.Face.build(grid, material);
                    this.name2topologyItem.set(grid.name.Hash(), face);
                    faces.addFace(face);
                }
                solid.addLOD(edges.build(), faces.build(), distance);
                break;
            }
        }
    }

    saveToMemento(registry: Map<any, any>): GeometryMemento {
        return new GeometryMemento(
            Clone(this.drawModel, registry),
            Clone(this.geometryModel, registry),
            Clone(this.scene, registry),
            Clone(this.name2topologyItem, registry))
    }

    restoreFromMemento(m: GeometryMemento) {
        // .drawModel and .scene are both public; it's best to modify in place
        // in case anyone has references to them. currently, we do this just for drawModel.

        this.drawModel.clear();
        for (const v of m.drawModel) this.drawModel.add(v);

        (this.scene as GeometryDatabase['scene']) = m.scene;
        (this.geometryModel as GeometryDatabase['geometryModel']) = m.geometryModel;
        (this.name2topologyItem as GeometryDatabase['name2topologyItem']) = m.name2topologyItem;
    }
}