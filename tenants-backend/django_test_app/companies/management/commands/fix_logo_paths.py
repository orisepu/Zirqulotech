from django.core.management.base import BaseCommand
from django_test_app.companies.models import Company


class Command(BaseCommand):
    help = 'Arregla las rutas de logos de los tenants'

    def handle(self, *args, **options):
        company = Company.objects.get(id=3)
        self.stdout.write(f'Company: {company.name}')
        self.stdout.write(f'Logo actual: {company.logo.name}')

        company.logo.name = 'logos/tenant-3.jpeg'
        company.save(update_fields=['logo'])

        self.stdout.write(self.style.SUCCESS('✅ Logo actualizado en BD'))
