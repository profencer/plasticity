import { GeometryDatabase } from "../editor/GeometryDatabase";
import c3d from '../build/Release/c3d.node';
import * as visual from '../editor/VisualModel';

abstract class AbstractSelection<T extends visual.Item | visual.TopologyItem | visual.ControlPoint, S extends c3d.SimpleName | string> {
    size: number;

    constructor(
        protected readonly db: GeometryDatabase,
        readonly ids: ReadonlySet<S>
    ) {
        this.size = ids.size;
    }

    *[Symbol.iterator]() {
        for (const id of this.ids) {
            yield this.lookupById(id) as T;
        }
    }

    get first() { return this[Symbol.iterator]().next().value as T }

    has(s: T) { return this.ids.has(s.simpleName as unknown as any) }

    abstract lookupById(id: S): T;
}

export class ItemSelection<T extends visual.Item> extends AbstractSelection<T, c3d.SimpleName> {
    lookupById(id: c3d.SimpleName) {
        return this.db.lookupItemById(id).view as T;
    }
}

export class TopologyItemSelection<T extends visual.TopologyItem> extends AbstractSelection<T, string> {
    lookupById(id: string) {
        const views = [...this.db.lookupTopologyItemById(id).views];
        return views[views.length - 1] as T;
    }
}
export class ControlPointSelection extends AbstractSelection<visual.ControlPoint, string> {
    lookupById(id: string) {
        return this.db.lookupControlPointById(id).views.values().next().value;
    }
}