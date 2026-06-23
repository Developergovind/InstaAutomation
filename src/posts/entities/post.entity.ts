import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  trendId!: string;

  @Column({ type: 'varchar' })
  keyword!: string;

  @Column('text')
  caption!: string;

  @Column('simple-array')
  hashtags!: string[];

  @Column('text')
  imagePrompt!: string;

  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  instagramPostId!: string | null;

  @Column({ type: 'varchar', default: 'draft' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  publishedAt!: Date | null;
}
