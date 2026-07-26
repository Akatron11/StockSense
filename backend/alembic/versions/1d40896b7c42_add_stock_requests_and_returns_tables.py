"""add stock_requests and returns/return_items tables

Revision ID: 1d40896b7c42
Revises: 09376591e0a7
Create Date: 2026-07-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1d40896b7c42'
down_revision: Union[str, Sequence[str], None] = '09376591e0a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('stock_requests',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('product_id', sa.BigInteger(), nullable=False),
    sa.Column('branch_id', sa.BigInteger(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('requested_by', sa.BigInteger(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_stock_requests_quantity_positive'),
    sa.ForeignKeyConstraint(['branch_id'], ['branches.id'], ),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['requested_by'], ['employees.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('returns',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('sale_id', sa.BigInteger(), nullable=False),
    sa.Column('initiated_by', sa.BigInteger(), nullable=False),
    sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
    sa.Column('net_amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('completed_by', sa.BigInteger(), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['completed_by'], ['employees.id'], ),
    sa.ForeignKeyConstraint(['initiated_by'], ['employees.id'], ),
    sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('return_items',
    sa.Column('id', sa.BigInteger(), nullable=False),
    sa.Column('return_id', sa.BigInteger(), nullable=False),
    sa.Column('product_id', sa.BigInteger(), nullable=False),
    sa.Column('quantity', sa.Integer(), nullable=False),
    sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('direction', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('quantity > 0', name='ck_return_items_quantity_positive'),
    sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
    sa.ForeignKeyConstraint(['return_id'], ['returns.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('return_items')
    op.drop_table('returns')
    op.drop_table('stock_requests')
