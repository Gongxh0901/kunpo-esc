console.log('Hello TypeScript!');

// 示例类型定义
interface Entity {
    id: number;
    components: Record<string, any>;
}

// 示例类
class World {
    private entities: Entity[] = [];

    createEntity(): Entity {
        const entity: Entity = {
            id: this.entities.length + 1,
            components: {}
        };
        this.entities.push(entity);
        return entity;
    }
}

// 使用示例
const world = new World();
const entity = world.createEntity();
console.log('Created entity:', entity);