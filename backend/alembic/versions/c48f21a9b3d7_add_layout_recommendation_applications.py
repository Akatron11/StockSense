"""add layout_recommendation_applications table

Revision ID: c48f21a9b3d7
Revises: 3a7c165fd5c4
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c48f21a9b3d7'
down_revision: Union[str, Sequence[str], None] = '3a7c165fd5c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('layout_recommendation_applications',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('branch_id', sa.BigInteger(), nullable=False),
    sa.Column('product_a_id', sa.BigInteger(), nullable=False),
    sa.Column('product_b_id', sa.BigInteger(), nullable=False),
    sa.Column('applied_by', sa.BigInteger(), nullable=False),
    sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
    sa.ForeignKeyConstraint(['product_a_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['product_b_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['applied_by'], ['employees.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('branch_id', 'product_a_id', 'product_b_id', name='uq_layout_application_branch_pair'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('layout_recommendation_applications')
