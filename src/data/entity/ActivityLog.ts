import { BeforeInsert, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Duration } from '../embedded/Duration';
import { CodeContext } from './CodeContext';
import { TransactionLog } from './TransactionLog';
import { WebRequest } from './WebRequest';

@Entity()
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  // @ManyToOne(type => Task, { nullable: false })
  // @JoinColumn()
  // task: Task;

  @ManyToOne((type) => WebRequest, (webRequest) => webRequest.activity)
  @JoinColumn()
  webRequest: WebRequest;

  @ManyToOne((type) => ActivityLog)
  @JoinColumn()
  parent: ActivityLog;

  children: ActivityLog[] = [];

  @ManyToOne((type) => TransactionLog)
  @JoinColumn()
  transaction: TransactionLog;

  @Column({ nullable: false })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column({ nullable: false })
  depth: number;

  @ManyToOne((type) => CodeContext)
  @JoinColumn()
  entryPoint: CodeContext;

  @Column((type) => Duration, { prefix: false })
  duration: Duration;

  // @ManyToOne
  // private Failure failure;

  @Column({ nullable: false })
  status: Status = Status.STARTED;

  constructor(name: string, description?: string) {
    this.duration = new Duration();
    this.name = name;
    this.description = description;
  }

  @BeforeInsert()
  computeDepth() {
    this.depth = (this.parent?.depth || 0) + 1;
  }
}

export enum Status {
  SUCCESSFUL = 'SUCCESSFUL',
  FAILED = 'FAILED',
  STARTED = 'STARTED',
}
