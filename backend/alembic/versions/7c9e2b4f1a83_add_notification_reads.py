"""add_notification_reads

Revision ID: 7c9e2b4f1a83
Revises: 3fe2cbfd7d52
Create Date: 2026-08-11 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c9e2b4f1a83'
down_revision: Union[str, Sequence[str], None] = '3fe2cbfd7d52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'notification_reads',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('employee_id', sa.BigInteger(), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('product_id', sa.BigInteger(), nullable=False),
        sa.Column('branch_id', sa.BigInteger(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['employee_id'], ['employees.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['branch_id'], ['branches.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('employee_id', 'kind', 'product_id', 'branch_id', name='uq_notification_read_employee_item'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notification_reads')
