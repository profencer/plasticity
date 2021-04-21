import { EditorSignals } from '../src/Editor';
import { GeometryDatabase } from '../src/GeometryDatabase';
import MaterialDatabase from '../src/MaterialDatabase';
import { FakeMaterials } from "../__mocks__/FakeMaterials";
import FakeSignals from '../__mocks__/FakeSignals';
import './matchers';
import c3d from '../build/Release/c3d.node';
import * as visual from '../src/VisualModel';

let db: GeometryDatabase;
let materials: Required<MaterialDatabase>;
let signals: EditorSignals;
let box: c3d.Solid;

beforeEach(() => {
    materials = new FakeMaterials();
    signals = FakeSignals();
    db = new GeometryDatabase(materials, signals);

    const points = [
        new c3d.CartPoint3D(0, 0, 0),
        new c3d.CartPoint3D(1, 0, 0),
        new c3d.CartPoint3D(1, 1, 0),
        new c3d.CartPoint3D(1, 1, 1),
    ]
    const names = new c3d.SNameMaker(c3d.CreatorType.ElementarySolid, c3d.ESides.SideNone, 0);
    box = c3d.ActionSolid.ElementarySolid(points, c3d.ElementaryShellType.Block, names);
})

test("addItem & lookup & removeItem", () => {
    const v = db.addItem(box) as visual.Solid;
    expect(db.lookup(v)).toBeTruthy();
    db.removeItem(v);
    expect(() => db.lookup(v)).toThrow();
})

test("lookupTopologyItem", () => {
    const v = db.addItem(box) as visual.Solid;
    for (const edge of v.edges) {
        expect(db.lookupTopologyItem(edge)).toBeTruthy();
    }
})